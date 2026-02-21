const pty = require("node-pty");
const fs = require("fs");
const path = require("path");
const { execSync, spawn } = require("child_process");

const PTY_ENV = {
  ...process.env,
  TERM: "xterm-256color",
  COLORTERM: "truecolor",
  CLAUDECODE: "",
  DISPLAY: ":99",
};

// Remove SSH env vars so Claude CLI doesn't think it's in SSH
delete PTY_ENV.SSH_CLIENT;
delete PTY_ENV.SSH_CONNECTION;
delete PTY_ENV.SSH_TTY;
delete PTY_ENV.SSH_AUTH_SOCK;

const DATA_DIR = path.join(process.env.HOME || "/root", "projects", "Claude");
const SESSIONS_FILE = path.join(DATA_DIR, ".sessions.json");

class TerminalManager {
  constructor() {
    this.sessions = new Map();
    this._loadSessions();
  }

  _saveSessions() {
    const data = [];
    for (const [id, session] of this.sessions) {
      data.push({
        sessionId: id,
        projectDir: session.projectDir,
        createdAt: session.createdAt,
        displayName: session.displayName,
      });
    }
    try {
      fs.writeFileSync(SESSIONS_FILE, JSON.stringify(data, null, 2));
    } catch {
      // Ignore write errors
    }
  }

  _loadSessions() {
    try {
      const raw = fs.readFileSync(SESSIONS_FILE, "utf-8");
      const data = JSON.parse(raw);
      for (const entry of data) {
        // Only restore if the project directory still exists
        if (fs.existsSync(entry.projectDir)) {
          this.sessions.set(entry.sessionId, {
            pty: null,
            projectDir: entry.projectDir,
            connectedClients: new Set(),
            createdAt: new Date(entry.createdAt),
            buffer: "",
            exited: true, // All restored sessions start as stopped
            displayName: entry.displayName || null,
          });
        }
      }
    } catch {
      // No saved sessions or corrupt file — start fresh
    }
  }

  _setupPty(session) {
    const ptyProcess = session.pty;

    ptyProcess.onData((data) => {
      session.buffer += data;
      if (session.buffer.length > 500000) {
        session.buffer = session.buffer.slice(-500000);
      }
      for (const client of session.connectedClients) {
        if (client.readyState === 1) {
          client.send(JSON.stringify({ type: "output", data }));
        }
      }
    });

    ptyProcess.onExit(({ exitCode, signal }) => {
      for (const client of session.connectedClients) {
        if (client.readyState === 1) {
          client.send(JSON.stringify({ type: "exit", exitCode, signal }));
        }
      }
      session.exited = true;
    });
  }

  createSession() {
    const now = new Date();
    const pad = (n) => n.toString().padStart(2, "0");
    const sessionId = [
      pad(now.getDate()),
      pad(now.getMonth() + 1),
      now.getFullYear(),
      pad(now.getHours()),
      pad(now.getMinutes()),
      pad(now.getSeconds()),
    ].join("-");

    const projectDir = path.join(DATA_DIR, sessionId);
    fs.mkdirSync(projectDir, { recursive: true });

    const ptyProcess = pty.spawn("/usr/bin/claude", [], {
      name: "xterm-256color",
      cols: 120,
      rows: 40,
      cwd: projectDir,
      env: PTY_ENV,
    });

    const session = {
      pty: ptyProcess,
      projectDir,
      connectedClients: new Set(),
      createdAt: now,
      buffer: "",
      exited: false,
      displayName: null,
    };

    this._setupPty(session);
    this.sessions.set(sessionId, session);
    this._saveSessions();
    return { sessionId, projectDir };
  }

  resumeSession(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) return { ok: false, error: "not_found" };
    if (!session.exited) return { ok: false, error: "already_active" };

    const ptyProcess = pty.spawn("/usr/bin/claude", ["--continue"], {
      name: "xterm-256color",
      cols: 120,
      rows: 40,
      cwd: session.projectDir,
      env: PTY_ENV,
    });

    session.pty = ptyProcess;
    session.exited = false;
    session.buffer = "";
    this._setupPty(session);

    return { ok: true };
  }

  stopSession(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session || session.exited) return false;
    session.pty.kill();
    session.exited = true;
    return true;
  }

  attachToSession(sessionId, ws) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      ws.send(JSON.stringify({ type: "error", message: "Session not found" }));
      ws.close();
      return;
    }

    session.connectedClients.add(ws);

    if (session.buffer) {
      ws.send(JSON.stringify({ type: "output", data: session.buffer }));
    }

    if (session.exited) {
      ws.send(JSON.stringify({ type: "stopped" }));
    }

    ws.on("message", (rawMessage) => {
      try {
        const message = JSON.parse(rawMessage.toString());
        switch (message.type) {
          case "input":
            if (!session.exited) {
              session.pty.write(message.data);
            }
            break;
          case "resize":
            if (!session.exited && message.cols && message.rows) {
              session.pty.resize(message.cols, message.rows);
            }
            break;
          case "image": {
            // Browser clipboard bridge: receive base64 image and put it into X11 clipboard
            const imgData = Buffer.from(message.data, "base64");
            try {
              // Kill previous xclip for THIS session (tracked by PID)
              if (session._xclipPid) {
                try { process.kill(session._xclipPid); } catch {}
                session._xclipPid = null;
              }

              // Spawn xclip async — it stays alive as daemon serving clipboard
              const xclipProc = spawn('xclip', ['-selection', 'clipboard', '-t', 'image/png'], {
                env: { ...process.env, DISPLAY: ':99' },
                stdio: ['pipe', 'ignore', 'pipe'],
              });

              session._xclipPid = xclipProc.pid;

              let xclipError = '';
              xclipProc.stderr.on('data', (chunk) => { xclipError += chunk.toString(); });

              xclipProc.on('error', (err) => {
                ws.send(JSON.stringify({ type: "output", data: `\r\n\x1b[31m✗ xclip error: ${err.message}\x1b[0m\r\n` }));
              });

              // Pipe image data to xclip stdin and close
              xclipProc.stdin.end(imgData);

              // After xclip takes clipboard ownership, send Ctrl+V to PTY
              setTimeout(() => {
                if (xclipError) {
                  ws.send(JSON.stringify({ type: "output", data: `\r\n\x1b[31m✗ xclip: ${xclipError}\x1b[0m\r\n` }));
                  return;
                }
                if (!session.exited) {
                  session.pty.write('\x16');
                }
              }, 200);
            } catch (err) {
              ws.send(JSON.stringify({ type: "output", data: `\r\n\x1b[31m✗ Ошибка clipboard: ${err.message}\x1b[0m\r\n` }));
            }
            break;
          }
        }
      } catch {
        // Ignore malformed messages
      }
    });

    ws.on("close", () => {
      session.connectedClients.delete(ws);
    });
  }

  detachFromSession(sessionId, ws) {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.connectedClients.delete(ws);
    }
  }

  deleteSession(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    // Safety check: projectDir must be inside DATA_DIR
    const resolved = path.resolve(session.projectDir);
    if (!resolved.startsWith(DATA_DIR + path.sep)) return false;

    if (!session.exited) {
      session.pty.kill();
      session.exited = true;
    }

    for (const client of session.connectedClients) {
      if (client.readyState === 1) {
        client.send(JSON.stringify({ type: "exit", exitCode: 0, signal: 0 }));
      }
      client.close();
    }

    try {
      fs.rmSync(session.projectDir, { recursive: true, force: true });
    } catch {
      // Directory might not exist
    }

    this.sessions.delete(sessionId);
    this._saveSessions();
    return true;
  }

  deleteSessionKeepFiles(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    if (!session.exited) {
      session.pty.kill();
      session.exited = true;
    }

    for (const client of session.connectedClients) {
      if (client.readyState === 1) {
        client.send(JSON.stringify({ type: "exit", exitCode: 0, signal: 0 }));
      }
      client.close();
    }

    // Do NOT delete projectDir — keep files
    this.sessions.delete(sessionId);
    this._saveSessions();
    return true;
  }

  sessionHasFiles(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) return false;
    try {
      const entries = fs.readdirSync(session.projectDir).filter((e) => !e.startsWith("."));
      return entries.length > 0;
    } catch {
      return false;
    }
  }

  renameSession(sessionId, newName) {
    const session = this.sessions.get(sessionId);
    if (!session) return null;

    const safeName = newName.replace(/[^a-zA-Zа-яА-ЯёЁ0-9\-_ ]/g, "").trim();
    if (!safeName) return null;

    session.displayName = safeName;
    this._saveSessions();
    return safeName;
  }

  getSession(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) return null;
    return {
      sessionId,
      projectDir: session.projectDir,
      isActive: !session.exited,
    };
  }

  listSessions() {
    const result = [];
    for (const [id, session] of this.sessions) {
      let hasFiles = false;
      try {
        const entries = fs.readdirSync(session.projectDir).filter((e) => !e.startsWith("."));
        hasFiles = entries.length > 0;
      } catch {
        // Directory might not exist
      }
      result.push({
        sessionId: id,
        displayName: session.displayName || null,
        projectDir: session.projectDir,
        createdAt: session.createdAt,
        isActive: !session.exited,
        connectedClients: session.connectedClients.size,
        hasFiles,
      });
    }
    return result;
  }
}

module.exports = { TerminalManager };

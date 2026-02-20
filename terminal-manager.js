const pty = require("node-pty");
const fs = require("fs");
const path = require("path");

const PTY_ENV = {
  ...process.env,
  TERM: "xterm-256color",
  COLORTERM: "truecolor",
  CLAUDECODE: "",
};

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
      if (session.buffer.length > 50000) {
        session.buffer = session.buffer.slice(-50000);
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

  renameSession(sessionId, newName) {
    const session = this.sessions.get(sessionId);
    if (!session) return null;

    const safeName = newName.replace(/[^a-zA-Zа-яА-ЯёЁ0-9\-_ ]/g, "").trim();
    if (!safeName) return null;

    session.displayName = safeName;
    this._saveSessions();
    return safeName;
  }

  listSessions() {
    const result = [];
    for (const [id, session] of this.sessions) {
      result.push({
        sessionId: id,
        displayName: session.displayName || null,
        projectDir: session.projectDir,
        createdAt: session.createdAt,
        isActive: !session.exited,
        connectedClients: session.connectedClients.size,
      });
    }
    return result;
  }
}

module.exports = { TerminalManager };

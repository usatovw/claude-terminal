const pty = require("node-pty");
const fs = require("fs");
const path = require("path");

class TerminalManager {
  constructor() {
    this.sessions = new Map();
  }

  createSession() {
    const now = new Date();
    const pad = (n) => n.toString().padStart(2, "0");
    const timestamp = [
      pad(now.getDate()),
      pad(now.getMonth() + 1),
      now.getFullYear(),
      pad(now.getHours()),
      pad(now.getMinutes()),
      pad(now.getSeconds()),
    ].join("-");

    const sessionId = timestamp;
    const projectDir = path.join(
      process.env.HOME || "/root",
      "projects",
      "Claude",
      sessionId
    );

    fs.mkdirSync(projectDir, { recursive: true });

    const ptyProcess = pty.spawn("/usr/bin/claude", [], {
      name: "xterm-256color",
      cols: 120,
      rows: 40,
      cwd: projectDir,
      env: {
        ...process.env,
        TERM: "xterm-256color",
        COLORTERM: "truecolor",
        CLAUDECODE: "",
      },
    });

    const session = {
      pty: ptyProcess,
      projectDir,
      connectedClients: new Set(),
      createdAt: now,
      buffer: "",
      exited: false,
    };

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

    this.sessions.set(sessionId, session);
    return { sessionId, projectDir };
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
      ws.send(JSON.stringify({ type: "exit", exitCode: 0, signal: 0 }));
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

  killSession(sessionId) {
    const session = this.sessions.get(sessionId);
    if (session && !session.exited) {
      session.pty.kill();
      session.exited = true;
      return true;
    }
    return false;
  }

  deleteSession(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    // Kill process if still running
    if (!session.exited) {
      session.pty.kill();
      session.exited = true;
    }

    // Close all connected clients
    for (const client of session.connectedClients) {
      if (client.readyState === 1) {
        client.send(JSON.stringify({ type: "exit", exitCode: 0, signal: 0 }));
      }
      client.close();
    }

    // Remove project directory
    try {
      fs.rmSync(session.projectDir, { recursive: true, force: true });
    } catch {
      // Directory might not exist
    }

    this.sessions.delete(sessionId);
    return true;
  }

  renameSession(sessionId, newName) {
    const session = this.sessions.get(sessionId);
    if (!session) return null;

    // Sanitize name — allow letters, digits, hyphens, underscores, spaces
    const safeName = newName.replace(/[^a-zA-Zа-яА-ЯёЁ0-9\-_ ]/g, "").trim();
    if (!safeName) return null;

    session.displayName = safeName;
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

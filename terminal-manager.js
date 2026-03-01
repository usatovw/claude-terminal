const pty = require("node-pty");
const fs = require("fs");
const path = require("path");
const { execSync, spawn } = require("child_process");

// ── tmux configuration ──
const TMUX_SOCKET = "claude-terminal";
const TMUX_CONF = path.join(__dirname, "tmux.conf");

function tmuxHasSession(sessionId) {
  try {
    execSync(`tmux -L ${TMUX_SOCKET} has-session -t "${sessionId}" 2>/dev/null`);
    return true;
  } catch {
    return false;
  }
}

function tmuxPaneAlive(sessionId) {
  try {
    const output = execSync(
      `tmux -L ${TMUX_SOCKET} list-panes -t "${sessionId}" -F "#{pane_dead}" 2>/dev/null`,
      { encoding: "utf-8" }
    ).trim();
    return output === "0";
  } catch {
    return false;
  }
}

// Strip alternate screen sequences so xterm.js stays in normal buffer.
// tmux uses alt screen internally — but xterm.js needs normal buffer
// for scrollback to work (mouse wheel scroll through history).
const ALT_SCREEN_RE = /\x1b\[\?(1049|1047|47)[hl]/g;

function tmuxCapture(sessionId, lines = 500) {
  try {
    return execSync(
      `tmux -L ${TMUX_SOCKET} capture-pane -t "${sessionId}" -p -e -S -${lines} 2>/dev/null`,
      { encoding: "utf-8", maxBuffer: 2 * 1024 * 1024 }
    );
  } catch {
    return "";
  }
}

// Allowlist of safe env vars for PTY sessions.
// NEVER spread process.env — it leaks JWT_SECRET, SMTP_PASS, etc.
const SAFE_ENV_KEYS = [
  "HOME", "USER", "LOGNAME", "SHELL", "PATH",
  "LANG", "LC_ALL", "LC_CTYPE", "LANGUAGE",
  "EDITOR", "VISUAL", "PAGER",
  "XDG_CONFIG_HOME", "XDG_DATA_HOME", "XDG_CACHE_HOME", "XDG_RUNTIME_DIR",
  "HOSTNAME", "TMPDIR", "TZ",
];

const PTY_ENV = {
  TERM: "xterm-256color",
  COLORTERM: "truecolor",
  CLAUDECODE: "",
  DISPLAY: ":99",
};

for (const key of SAFE_ENV_KEYS) {
  if (process.env[key]) PTY_ENV[key] = process.env[key];
}

const DATA_DIR = path.join(process.env.HOME || "/root", "projects", "Claude");
const SESSIONS_FILE = path.join(DATA_DIR, ".sessions.json");

// Build env string for tmux session command
function buildEnvPrefix() {
  return Object.entries(PTY_ENV)
    .map(([k, v]) => `${k}='${v.replace(/'/g, "'\\''")}'`)
    .join(" ");
}

// Validate command string: no shell metacharacters
function validateCommand(cmd) {
  if (/[;|&$`\\]/.test(cmd)) {
    throw new Error("Command contains forbidden shell metacharacters");
  }
}

// Attach node-pty to an existing tmux session
function attachTmux(sessionId, cols = 120, rows = 40, cwd) {
  return pty.spawn("tmux", [
    "-L", TMUX_SOCKET, "-f", TMUX_CONF,
    "attach-session", "-t", sessionId,
  ], {
    name: "xterm-256color",
    cols,
    rows,
    cwd: cwd || process.env.HOME || "/root",
    env: PTY_ENV,
  });
}

class TerminalManager {
  constructor() {
    this.sessions = new Map();
    this.ephemeralSessions = new Map();
    this._watchCallback = null;
    this._loadSessions();              // Load known sessions FIRST
    this._cleanupOrphanedTmux();       // THEN clean orphans not in the loaded set
    this._reconnectTmuxSessions();
    this._watchSessionsFile();
  }

  _saveSessions() {
    const data = [];
    for (const [id, session] of this.sessions) {
      data.push({
        sessionId: id,
        projectDir: session.projectDir,
        createdAt: session.createdAt,
        displayName: session.displayName,
        providerSlug: session.providerSlug || "claude",
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
            exited: true, // Will be updated by _reconnectTmuxSessions
            displayName: entry.displayName || null,
            providerSlug: entry.providerSlug || "claude",
          });
        }
      }
    } catch {
      // No saved sessions or corrupt file — start fresh
    }
  }

  // Check tmux sessions that survived server restart — lazy re-attach
  // Does NOT spawn node-pty here. PTY is attached lazily when a client connects
  // via attachToSession(). This prevents dual-attach during blue-green deploy overlap.
  _reconnectTmuxSessions() {
    for (const [sessionId, session] of this.sessions) {
      if (session.exited && tmuxHasSession(sessionId)) {
        if (!tmuxPaneAlive(sessionId)) {
          // tmux session exists but pane is dead — clean up
          console.log(`> Dead tmux pane: ${sessionId} — killing session`);
          try {
            execSync(`tmux -L ${TMUX_SOCKET} kill-session -t "${sessionId}" 2>/dev/null`);
          } catch {}
          continue;
        }
        session.exited = false;
        // Pre-capture buffer so first client gets history immediately
        session.buffer = tmuxCapture(sessionId, 100) || "";
        console.log(`> tmux session alive: ${sessionId} (PTY will attach on client connect)`);
      }
    }
  }

  // Kill tmux sessions not tracked in .sessions.json
  _cleanupOrphanedTmux() {
    try {
      const output = execSync(
        `tmux -L ${TMUX_SOCKET} list-sessions -F "#{session_name}" 2>/dev/null`,
        { encoding: "utf-8" }
      );
      const tmuxSessions = output.trim().split("\n").filter(Boolean);
      const knownIds = new Set(this.sessions.keys());

      for (const tmuxName of tmuxSessions) {
        if (!knownIds.has(tmuxName)) {
          console.log(`> Killing orphaned tmux session: ${tmuxName}`);
          try {
            execSync(`tmux -L ${TMUX_SOCKET} kill-session -t "${tmuxName}" 2>/dev/null`);
          } catch {}
        }
      }
    } catch {
      // No tmux server running — nothing to clean
    }
  }

  // Watch .sessions.json for changes from another instance (blue-green deploy)
  _watchSessionsFile() {
    try {
      this._watchCallback = () => {
        this._syncFromDisk();
      };
      fs.watchFile(SESSIONS_FILE, { interval: 2000 }, this._watchCallback);
    } catch {
      // Ignore watch errors
    }
  }

  // Cleanup: remove file watcher (call from server.js graceful shutdown)
  destroy() {
    if (this._watchCallback) {
      fs.unwatchFile(SESSIONS_FILE, this._watchCallback);
      this._watchCallback = null;
    }
  }

  _syncFromDisk() {
    try {
      const raw = fs.readFileSync(SESSIONS_FILE, "utf-8");
      const data = JSON.parse(raw);
      for (const entry of data) {
        if (!this.sessions.has(entry.sessionId) && fs.existsSync(entry.projectDir)) {
          const session = {
            pty: null,
            projectDir: entry.projectDir,
            connectedClients: new Set(),
            createdAt: new Date(entry.createdAt),
            buffer: "",
            exited: true,
            displayName: entry.displayName || null,
            providerSlug: entry.providerSlug || "claude",
          };

          // Check if tmux session exists with alive pane (created by another instance)
          if (tmuxHasSession(entry.sessionId) && tmuxPaneAlive(entry.sessionId)) {
            session.exited = false;
            session.buffer = tmuxCapture(entry.sessionId, 100) || "";
            console.log(`> Synced tmux session from disk: ${entry.sessionId} (lazy)`);
          }

          this.sessions.set(entry.sessionId, session);
        }
      }
    } catch {}
  }

  _setupPty(session, sessionId) {
    const ptyProcess = session.pty;

    ptyProcess.onData((rawData) => {
      // Strip alternate screen sequences — keeps xterm.js in normal buffer
      // so scrollback works. tmux still uses alt screen internally.
      const data = rawData.replace(ALT_SCREEN_RE, "");
      if (!data) return;

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

    ptyProcess.onExit(() => {
      // node-pty (tmux attach) exited. Always clear PTY ref.
      session.pty = null;

      if (tmuxHasSession(sessionId)) {
        // tmux still alive — our attachment just died (server restart, deploy, etc.)
        // Don't mark as exited. Clients will auto-reconnect and get a new PTY attachment.
        console.log(`> PTY detached from tmux ${sessionId} (tmux still alive)`);
      } else {
        // tmux session gone — CLI actually exited
        session.exited = true;
        for (const client of session.connectedClients) {
          if (client.readyState === 1) {
            client.send(JSON.stringify({ type: "exit", exitCode: 0, signal: 0 }));
          }
        }
      }
    });
  }

  createSession(providerSlug = "claude") {
    // Look up provider from DB
    const db = global.db;
    const provider = db.prepare("SELECT * FROM cli_providers WHERE slug = ?").get(providerSlug);
    if (!provider) {
      throw new Error(`Provider "${providerSlug}" not found`);
    }

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

    validateCommand(provider.command);
    const command = provider.command;
    const envPrefix = buildEnvPrefix();

    // Create tmux session with the CLI command
    try {
      execSync(
        `tmux -L ${TMUX_SOCKET} -f ${TMUX_CONF} new-session -d -s "${sessionId}" -x 120 -y 40 -c "${projectDir}" -- env ${envPrefix} ${command}`,
        { stdio: ["pipe", "pipe", "pipe"] }
      );
    } catch (err) {
      throw new Error(`Failed to create tmux session: ${err.message}`);
    }

    // Attach node-pty to the tmux session
    const ptyProcess = attachTmux(sessionId, 120, 40, projectDir);

    const session = {
      pty: ptyProcess,
      projectDir,
      connectedClients: new Set(),
      createdAt: now,
      buffer: "",
      exited: false,
      displayName: null,
      providerSlug,
    };

    this._setupPty(session, sessionId);
    this.sessions.set(sessionId, session);
    this._saveSessions();
    return { sessionId, projectDir };
  }

  resumeSession(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) return { ok: false, error: "not_found" };
    if (!session.exited) return { ok: false, error: "already_active" };

    // Clean up any leftover tmux session
    if (tmuxHasSession(sessionId)) {
      try {
        execSync(`tmux -L ${TMUX_SOCKET} kill-session -t "${sessionId}" 2>/dev/null`);
      } catch {}
    }

    // Look up provider for resume command
    const db = global.db;
    const provider = db.prepare("SELECT * FROM cli_providers WHERE slug = ?").get(session.providerSlug || "claude");

    let command;
    if (provider && provider.resume_command) {
      validateCommand(provider.resume_command);
      command = provider.resume_command;
    } else if (provider) {
      validateCommand(provider.command);
      command = provider.command;
    } else {
      command = "/bin/bash";
    }

    const envPrefix = buildEnvPrefix();

    // Create new tmux session with the resume command
    try {
      execSync(
        `tmux -L ${TMUX_SOCKET} -f ${TMUX_CONF} new-session -d -s "${sessionId}" -x 120 -y 40 -c "${session.projectDir}" -- env ${envPrefix} ${command}`,
        { stdio: ["pipe", "pipe", "pipe"] }
      );
    } catch (err) {
      return { ok: false, error: `tmux: ${err.message}` };
    }

    // Attach node-pty
    const ptyProcess = attachTmux(sessionId, 120, 40, session.projectDir);

    session.pty = ptyProcess;
    session.exited = false;
    session.buffer = "";
    this._setupPty(session, sessionId);

    return { ok: true };
  }

  stopSession(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session || session.exited) return false;

    // Kill the tmux session (kills CLI inside it)
    if (tmuxHasSession(sessionId)) {
      try {
        execSync(`tmux -L ${TMUX_SOCKET} kill-session -t "${sessionId}" 2>/dev/null`);
      } catch {}
    }

    // Also kill the node-pty attachment
    if (session.pty) {
      try { session.pty.kill(); } catch {}
    }

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

    // Lazy PTY attachment: if tmux is alive but no node-pty is attached,
    // spawn PTY now (first client to connect gets it)
    if (!session.exited && !session.pty && tmuxHasSession(sessionId)) {
      if (!tmuxPaneAlive(sessionId)) {
        // Pane is dead (e.g. [lost tty]) — clean up and mark stopped
        console.log(`> Dead tmux pane on attach: ${sessionId} — cleaning up`);
        try {
          execSync(`tmux -L ${TMUX_SOCKET} kill-session -t "${sessionId}" 2>/dev/null`);
        } catch {}
        session.exited = true;
      } else {
        try {
          // Capture full buffer before attaching PTY
          session.buffer = tmuxCapture(sessionId, 500) || session.buffer;
          const ptyProcess = attachTmux(sessionId, 120, 40, session.projectDir);
          session.pty = ptyProcess;
          this._setupPty(session, sessionId);
          console.log(`> Lazy PTY attached to tmux: ${sessionId}`);
        } catch (err) {
          // Kill PTY if it was spawned but setup failed
          if (session.pty) {
            try { session.pty.kill(); } catch {}
            session.pty = null;
          }
          console.error(`> Failed to lazy-attach PTY to tmux ${sessionId}:`, err.message);
        }
      }
    }

    // Send buffered output to the new client
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
            if (!session.exited && session.pty) {
              session.pty.write(message.data);
            }
            break;
          case "resize":
            if (!session.exited && session.pty && message.cols && message.rows) {
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
                if (!session.exited && session.pty) {
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

    // Kill xclip process if alive
    if (session._xclipPid) {
      try { process.kill(session._xclipPid); } catch {}
      session._xclipPid = null;
    }

    // Kill tmux session if alive
    if (tmuxHasSession(sessionId)) {
      try {
        execSync(`tmux -L ${TMUX_SOCKET} kill-session -t "${sessionId}" 2>/dev/null`);
      } catch {}
    }

    if (!session.exited && session.pty) {
      try { session.pty.kill(); } catch {}
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

    // Kill xclip process if alive
    if (session._xclipPid) {
      try { process.kill(session._xclipPid); } catch {}
      session._xclipPid = null;
    }

    // Kill tmux session if alive
    if (tmuxHasSession(sessionId)) {
      try {
        execSync(`tmux -L ${TMUX_SOCKET} kill-session -t "${sessionId}" 2>/dev/null`);
      } catch {}
    }

    if (!session.exited && session.pty) {
      try { session.pty.kill(); } catch {}
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
      providerSlug: session.providerSlug || "claude",
    };
  }

  // ── Ephemeral sessions (for provider wizard auth terminal) ──
  // These remain as direct node-pty — they're short-lived and non-critical

  createEphemeralSession() {
    if (this.ephemeralSessions.size >= 3) {
      throw new Error("Max ephemeral sessions reached (3)");
    }

    const id = `eph-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

    const ptyProcess = pty.spawn("/bin/bash", [], {
      name: "xterm-256color",
      cols: 120,
      rows: 15,
      cwd: process.env.HOME || "/root",
      env: PTY_ENV,
    });

    const session = {
      pty: ptyProcess,
      connectedClients: new Set(),
      buffer: "",
      exited: false,
      createdAt: Date.now(),
    };

    // Auto-destroy after 5 minutes
    session._timeout = setTimeout(() => {
      this.destroyEphemeralSession(id);
    }, 5 * 60 * 1000);

    this._setupEphemeralPty(session);
    this.ephemeralSessions.set(id, session);
    return id;
  }

  // Separate setup for ephemeral sessions (no tmux check on exit)
  _setupEphemeralPty(session) {
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

  attachToEphemeralSession(id, ws) {
    const session = this.ephemeralSessions.get(id);
    if (!session) {
      ws.send(JSON.stringify({ type: "error", message: "Ephemeral session not found" }));
      ws.close();
      return;
    }

    session.connectedClients.add(ws);

    if (session.buffer) {
      ws.send(JSON.stringify({ type: "output", data: session.buffer }));
    }

    ws.on("message", (rawMessage) => {
      try {
        const message = JSON.parse(rawMessage.toString());
        if (message.type === "input" && !session.exited) {
          session.pty.write(message.data);
        } else if (message.type === "resize" && !session.exited && message.cols && message.rows) {
          session.pty.resize(message.cols, message.rows);
        }
      } catch {}
    });

    ws.on("close", () => {
      session.connectedClients.delete(ws);
    });
  }

  destroyEphemeralSession(id) {
    const session = this.ephemeralSessions.get(id);
    if (!session) return false;

    if (session._timeout) clearTimeout(session._timeout);

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

    this.ephemeralSessions.delete(id);
    return true;
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
        providerSlug: session.providerSlug || "claude",
      });
    }
    return result;
  }
}

module.exports = { TerminalManager };

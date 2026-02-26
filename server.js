const fs = require("fs");
const path = require("path");

// Load .env.local before anything else (PM2 doesn't load dotenv files)
const envPath = path.join(__dirname, ".env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf-8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx);
    let val = trimmed.slice(eqIdx + 1);
    // Unescape \$ → $
    val = val.replace(/\\\$/g, "$");
    if (!process.env[key]) process.env[key] = val;
  }
}

const { createServer } = require("http");
const { parse } = require("url");
const next = require("next");
const { WebSocketServer } = require("ws");
const jwt = require("jsonwebtoken");
const { execSync, spawn } = require("child_process");

// ── Ensure Xvfb is running on :99 (needed for xclip clipboard bridge) ──
(function ensureXvfb() {
  // Check via X11 lock file — reliable and doesn't false-match shell wrappers
  if (fs.existsSync("/tmp/.X99-lock")) {
    console.log("> Xvfb :99 already running (lock file exists)");
    return;
  }
  console.log("> Starting Xvfb on :99...");
  const xvfb = spawn("Xvfb", [":99", "-screen", "0", "1024x768x24"], {
    stdio: "ignore",
    detached: true,
  });
  xvfb.unref();
  // Give it a moment to create the lock file
  execSync("sleep 0.5");
  console.log("> Xvfb started (PID:", xvfb.pid + ")");
})();

const db = require("./db");
global.db = db;
const { TerminalManager } = require("./terminal-manager");
const { PresenceManager } = require("./presence-manager");
const { ChatManager } = require("./chat-manager");

const dev = process.env.NODE_ENV !== "production";
const hostname = "127.0.0.1";
const port = parseInt(process.env.PORT || "3000", 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

/**
 * Verify JWT and return decoded payload (or null on failure).
 */
function verifyJWT(token) {
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return null;
  }
}

app.prepare().then(() => {
  const terminalManager = new TerminalManager();
  global.terminalManager = terminalManager;

  const presenceManager = new PresenceManager();
  global.presenceManager = presenceManager;

  const chatManager = new ChatManager(presenceManager);
  global.chatManager = chatManager;

  const server = createServer((req, res) => {
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  });

  const wss = new WebSocketServer({ noServer: true });
  const wssPresence = new WebSocketServer({ noServer: true });

  server.on("upgrade", (request, socket, head) => {
    const { pathname, query } = parse(request.url, true);

    if (pathname === "/api/terminal") {
      const token = query.token;
      const decoded = token ? verifyJWT(token) : null;

      if (!decoded) {
        socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
        socket.destroy();
        return;
      }

      wss.handleUpgrade(request, socket, head, (ws) => {
        const sessionId = query.sessionId;
        if (!sessionId) {
          ws.send(
            JSON.stringify({ type: "error", message: "No sessionId provided" })
          );
          ws.close();
          return;
        }

        // Ephemeral sessions (for provider wizard auth terminal)
        if (query.ephemeral === "true") {
          terminalManager.attachToEphemeralSession(sessionId, ws);
        } else {
          terminalManager.attachToSession(sessionId, ws);
        }
      });
      return;
    }

    if (pathname === "/api/presence") {
      const token = query.token;
      const decoded = token ? verifyJWT(token) : null;

      if (!decoded) {
        socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
        socket.destroy();
        return;
      }

      wssPresence.handleUpgrade(request, socket, head, (ws) => {
        const peerId = query.peerId;

        if (!peerId) {
          ws.close();
          return;
        }

        // Use name from JWT token if available, fallback to query param
        const name = decoded.firstName
          ? [decoded.firstName, decoded.lastName].filter(Boolean).join(" ")
          : decodeURIComponent(query.name || "");

        const { colorIndex } = presenceManager.addPeer(peerId, ws, name);
        ws.send(JSON.stringify({ type: "welcome", peerId, colorIndex }));

        ws.on("message", (raw) => {
          try {
            const msg = JSON.parse(raw.toString());
            switch (msg.type) {
              case "join":
              case "switch":
                presenceManager.joinSession(peerId, msg.sessionId);
                break;
              case "cursor":
                presenceManager.handleCursor(peerId, { x: msg.x, yBot: msg.yBot, vh: msg.vh });
                break;
              case "chat":
                presenceManager.handleChat(peerId, msg.text);
                break;
              case "chat_close":
                presenceManager.handleChatClose(peerId);
                break;
            }
          } catch {}
        });

        ws.on("close", () => {
          presenceManager.removePeer(peerId);
        });
      });
      return;
    }

    // Don't destroy socket for other paths (Next.js HMR needs upgrade too)
  });

  server.listen(port, hostname, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
    console.log(`> Environment: ${dev ? "development" : "production"}`);
  });
});

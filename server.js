const { createServer } = require("http");
const { parse } = require("url");
const next = require("next");
const { WebSocketServer } = require("ws");
const jwt = require("jsonwebtoken");
const { TerminalManager } = require("./terminal-manager");
const { PresenceManager } = require("./presence-manager");

const dev = process.env.NODE_ENV !== "production";
const hostname = "127.0.0.1";
const port = parseInt(process.env.PORT || "3000", 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

function verifyJWT(token) {
  try {
    jwt.verify(token, process.env.JWT_SECRET);
    return true;
  } catch {
    return false;
  }
}

app.prepare().then(() => {
  const terminalManager = new TerminalManager();
  global.terminalManager = terminalManager;

  const presenceManager = new PresenceManager();

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

      if (!token || !verifyJWT(token)) {
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
        terminalManager.attachToSession(sessionId, ws);
      });
      return;
    }

    if (pathname === "/api/presence") {
      const token = query.token;
      if (!token || !verifyJWT(token)) {
        socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
        socket.destroy();
        return;
      }

      wssPresence.handleUpgrade(request, socket, head, (ws) => {
        const peerId = query.peerId;
        const name = decodeURIComponent(query.name || "");

        if (!peerId) {
          ws.close();
          return;
        }

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
                presenceManager.handleCursor(peerId, msg.x, msg.y);
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

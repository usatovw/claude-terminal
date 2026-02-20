const { createServer } = require("http");
const { parse } = require("url");
const next = require("next");
const { WebSocketServer } = require("ws");
const jwt = require("jsonwebtoken");
const { TerminalManager } = require("./terminal-manager");

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

  const server = createServer((req, res) => {
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  });

  const wss = new WebSocketServer({ noServer: true });

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

    // Don't destroy socket for other paths (Next.js HMR needs upgrade too)
  });

  server.listen(port, hostname, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
    console.log(`> Environment: ${dev ? "development" : "production"}`);
  });
});

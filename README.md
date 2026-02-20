# Claude Terminal

Self-hosted web interface for [Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code). Run Claude on your server, use it from any browser.

![Next.js](https://img.shields.io/badge/Next.js-16-black) ![node-pty](https://img.shields.io/badge/node--pty-terminal-green) ![License](https://img.shields.io/badge/license-MIT-blue)

## Features

- **Full terminal in the browser** — xterm.js connected to real Claude CLI via WebSocket + node-pty
- **Multi-session** — create, stop, resume, rename, delete sessions with loading states
- **File manager** — browse, download, rename, delete files in session directories; recursive search; bulk zip-download; resizable columns
- **Stopped session overlay** — decorative terminal-style background with one-click resume
- **Image paste** — Ctrl+V images from clipboard directly into Claude CLI (via X11 bridge)
- **Mobile-first** — adaptive layout throughout: sidebar drawer, touch-friendly targets, hidden columns on small screens
- **Auth** — password login with bcrypt, JWT, rate limiting
- **Single-user** — designed for personal use on your own server

## Requirements

- **VPS/server** with Linux (Ubuntu 22+ recommended)
- **Node.js 18+**
- **Claude CLI** installed and authenticated (`npm install -g @anthropic-ai/claude-code`, then `claude` to login)
- **Active Anthropic subscription** (Claude Pro / Max / Team)
- **Domain + SSL** (for secure clipboard access in the browser)

## Quick Start

### 1. Clone and install

```bash
git clone https://github.com/YOUR_USERNAME/claude-terminal.git
cd claude-terminal
npm install
```

### 2. Configure environment

```bash
cp .env.example .env.local
```

Generate your password hash and JWT secret:

```bash
# Generate password hash (replace 'your_password' with your actual password)
node -e "require('bcryptjs').hash('your_password', 12).then(console.log)"

# Generate JWT secret
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

Edit `.env.local`:

```env
LOGIN_USERNAME=admin
PASSWORD_HASH=$2b$12$paste_your_hash_here
JWT_SECRET=paste_your_64_byte_hex_here
SESSION_TIMEOUT_HOURS=24
```

### 3. Build

```bash
npm run build
```

### 4. Set up Xvfb (for image clipboard bridge)

Claude CLI reads images from X11 clipboard. Since the server is headless, we need a virtual display:

```bash
# Install
sudo apt install -y xvfb xclip

# Start virtual display
Xvfb :99 -screen 0 1024x768x24 &
```

<details>
<summary>Systemd service for Xvfb (recommended)</summary>

```bash
sudo tee /etc/systemd/system/xvfb.service << 'EOF'
[Unit]
Description=Virtual Framebuffer
After=network.target

[Service]
ExecStart=/usr/bin/Xvfb :99 -screen 0 1024x768x24
Restart=always
User=root

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl enable --now xvfb
```

</details>

### 5. Run with PM2

```bash
# Install PM2
npm install -g pm2

# Edit ecosystem.config.js — update `cwd` path to your project directory
# Start
pm2 start ecosystem.config.js

# Auto-start on reboot
pm2 save
pm2 startup
```

### 6. Nginx reverse proxy

The app runs on `127.0.0.1:3000`. Set up Nginx to proxy with WebSocket support:

```nginx
server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 86400;
    }
}

server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$host$request_uri;
}
```

Get SSL with Let's Encrypt:

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

### 7. Open in browser

Go to `https://your-domain.com`, login with the username/password you configured, and start using Claude.

## How it works

```
Browser (xterm.js) <--WebSocket--> server.js <--node-pty--> Claude CLI
                                       |
                                  Next.js API routes
                                  (auth, sessions, files)
```

1. **server.js** starts an HTTP server with Next.js + WebSocket support
2. On login, a JWT token is issued and stored in an httpOnly cookie
3. When a session is opened, xterm.js connects via WebSocket to the server
4. **terminal-manager.js** spawns `claude` CLI in a pseudo-terminal (node-pty)
5. Input/output is streamed between the browser and PTY in real-time
6. Image paste uses an X11 clipboard bridge (Xvfb + xclip on DISPLAY :99)
7. File manager reads session directories via REST API (browse, search, download, rename, delete)

## Project structure

```
├── server.js                    # HTTP + WebSocket entry point
├── terminal-manager.js          # PTY session lifecycle manager
├── ecosystem.config.js          # PM2 config
├── src/
│   ├── app/
│   │   ├── page.tsx             # Login page (Aurora background)
│   │   ├── dashboard/page.tsx   # Main dashboard — sidebar + terminal + files
│   │   └── api/
│   │       ├── auth/            # Login, logout, ws-token endpoints
│   │       └── sessions/        # Session CRUD + file operations API
│   ├── components/
│   │   ├── Terminal.tsx          # xterm.js client + clipboard bridge
│   │   ├── SessionList.tsx      # Session sidebar with actions
│   │   ├── Navbar.tsx           # Top bar (session name, view toggle, status)
│   │   ├── FileManager.tsx      # File browser with search, sort, bulk ops
│   │   ├── StoppedSessionOverlay.tsx  # Resume screen for stopped sessions
│   │   ├── file-manager/        # FileItem, FileList, FileTableHeader, etc.
│   │   └── ui/                  # Aceternity UI components
│   └── lib/
│       ├── auth.ts              # JWT + bcrypt helpers
│       ├── files.ts             # Path sanitization for file API
│       ├── utils.ts             # formatFileSize, relativeTime
│       └── useIsMobile.ts       # Responsive breakpoint hook
```

See [CLAUDE.md](CLAUDE.md) for detailed architecture documentation.

## Updating

```bash
git pull
npm install
npm run build
pm2 restart claude-terminal
```

## Security notes

- All secrets are in `.env.local` (never committed to git)
- Passwords stored as bcrypt hashes (one-way)
- JWT tokens expire after `SESSION_TIMEOUT_HOURS`
- Login rate-limited to 5 attempts per 15 minutes per IP
- WebSocket connections require valid short-lived JWT
- Cookies are httpOnly + secure + SameSite=strict in production
- Server listens on 127.0.0.1 only (not exposed directly)
- File API sandboxed to session project directories (path traversal protection)
- HTML pages served with `no-cache` headers to prevent stale bundles after deploys

## License

MIT

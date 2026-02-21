# Claude Terminal

Self-hosted web interface for [Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code). Multi-user, multi-session terminal in the browser with global chat. Built for running Claude CLI on a remote server and accessing it from any device.

![Next.js](https://img.shields.io/badge/Next.js-16-black) ![SQLite](https://img.shields.io/badge/SQLite-WAL-blue) ![node-pty](https://img.shields.io/badge/node--pty-terminal-green) ![License](https://img.shields.io/badge/license-MIT-blue)

## Features

- **Full terminal in the browser** — xterm.js connected to real Claude CLI via WebSocket + node-pty
- **Multi-user auth** — registration with admin email approval, guest access via code, role-based permissions (admin / user / guest)
- **Global chat** — persistent messages with markdown, file/image attachments, media gallery, real-time delivery via WebSocket
- **Multi-session** — create, stop, resume, rename, delete sessions with loading states
- **File manager** — browse, download, rename, delete files in session directories; recursive search; bulk zip-download
- **Presence** — Figma-like cursors, live chat bubbles, session avatars via WebSocket
- **Image paste** — Ctrl+V images from clipboard directly into Claude CLI (via X11 bridge)
- **Mobile-first** — adaptive layout throughout: sidebar drawer, touch-friendly targets, chat overlay
- **404 page** — Aceternity Lamp effect, because even errors should look good

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

Generate secrets:

```bash
# Generate JWT secret
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

Edit `.env.local`:

```env
JWT_SECRET=paste_your_64_byte_hex_here
SESSION_TIMEOUT_HOURS=24
GUEST_ACCESS_CODE=your_secret_guest_code
ADMIN_EMAIL=admin@example.com
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password
APP_URL=https://your-domain.com
```

### 3. Create admin user

```bash
# Generate password hash
node -e "require('bcryptjs').hash('your_password', 10).then(console.log)"

# Insert admin into DB (run after first server start creates the DB)
node -e "
const db = require('./db');
db.prepare(\"INSERT INTO users (login, password_hash, first_name, role, status, color_index) VALUES (?, 'PASTE_HASH_HERE', 'Admin', 'admin', 'approved', 0)\").run('your_login');
"
```

### 4. Build

```bash
npm run build
```

### 5. Set up Xvfb (for image clipboard bridge)

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

### 6. Run with PM2

```bash
# Install PM2
npm install -g pm2

# Start
pm2 start ecosystem.config.js

# Auto-start on reboot
pm2 save
pm2 startup
```

### 7. Nginx reverse proxy

The app runs on `127.0.0.1:3000`. Set up Nginx to proxy with WebSocket support:

```nginx
server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;

    client_max_body_size 55M;  # for chat file uploads (50MB + overhead)

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

### 8. Open in browser

Go to `https://your-domain.com`, login with your admin account, and start using Claude.

New users can register — you'll receive an approval email with one-click approve/reject buttons. Guests can enter with the secret access code (read-only chat).

## How it works

```
Browser (xterm.js) ←WebSocket→ server.js ←node-pty→ Claude CLI
Browser (chat UI)  ←REST+WS──→ server.js ←────────→ SQLite (messages, users)
Browser (presence) ←WebSocket→ server.js ←────────→ PresenceManager (cursors, peers)
                                    ↑
                               Next.js API routes
                               (auth, sessions, files, chat)
```

1. **server.js** starts HTTP server with Next.js + WebSocket, loads `.env.local`, initializes SQLite DB
2. Users register → admin receives email → approves/rejects via link
3. On login, JWT token with user identity is issued (httpOnly cookie)
4. Terminal sessions connect via WebSocket, PTY spawned by **terminal-manager.js**
5. Chat messages stored in SQLite, broadcast to all peers via presence WebSocket
6. Image paste uses X11 clipboard bridge (Xvfb + xclip on DISPLAY :99)
7. File manager reads session directories via REST API

## Project structure

```
├── server.js                    # HTTP + WebSocket entry point
├── db.js                        # SQLite init, schema, admin seed
├── chat-manager.js              # Persistent chat: messages, files, broadcast
├── terminal-manager.js          # PTY session lifecycle manager
├── presence-manager.js          # Cursor, ephemeral chat, peer tracking
├── ecosystem.config.js          # PM2 config
├── data/                        # SQLite database (gitignored)
├── chat-uploads/                # Uploaded files (gitignored)
├── src/
│   ├── app/
│   │   ├── page.tsx             # Login page (Aurora background)
│   │   ├── not-found.tsx        # 404 page (Lamp effect)
│   │   ├── dashboard/page.tsx   # Dashboard — sidebar + terminal + chat
│   │   └── api/
│   │       ├── auth/            # Login, register, approve, guest, logout, ws-token
│   │       ├── chat/            # Messages (CRUD), uploads (serve), media (gallery)
│   │       └── sessions/        # Session CRUD + file operations
│   ├── components/
│   │   ├── LoginForm.tsx        # Three modes: login / register / guest
│   │   ├── Terminal.tsx         # xterm.js client + clipboard bridge
│   │   ├── SessionList.tsx      # Session sidebar + logout button
│   │   ├── Navbar.tsx           # Top bar with chat toggle
│   │   ├── chat/               # ChatPanel, ChatMessage, ChatInput, DateSeparator,
│   │   │                       # MediaGallery, ImageLightbox
│   │   ├── presence/           # PresenceProvider, CursorOverlay, Cursor, Avatars
│   │   ├── file-manager/       # FileItem, FileList, FileTableHeader, etc.
│   │   └── ui/                 # Aceternity UI components
│   └── lib/
│       ├── auth.ts             # JWT (full payload) + bcrypt
│       ├── db.ts               # TS wrapper for global.db
│       ├── email.ts            # Nodemailer for registration emails
│       ├── UserContext.tsx      # React context for user identity
│       ├── markdown.ts         # Lightweight MD→HTML renderer
│       ├── presence-colors.ts  # 12-color palette
│       └── presence-names.ts   # Random Russian name generator
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

- All secrets in `.env.local` (gitignored, never committed)
- Passwords stored as bcrypt hashes (one-way)
- JWT tokens carry user identity, expire after configured hours
- Login rate-limited to 5 attempts per 15 minutes per IP
- WebSocket connections require valid short-lived JWT (30s)
- Cookies: httpOnly + secure + SameSite=strict in production
- Server listens on 127.0.0.1 only (not exposed directly)
- File API sandboxed to session directories (path traversal protection)
- Chat uploads validated by MIME type and size (50MB max)
- Registration requires admin approval — no self-service access
- Guest access requires secret code, read-only in chat

## License

MIT

# Claude Terminal

Self-hosted web interface for [Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code). Multi-user, multi-session terminal in the browser with global chat. Built for running Claude CLI on a remote server and accessing it from any device.

![Next.js](https://img.shields.io/badge/Next.js-16-black) ![SQLite](https://img.shields.io/badge/SQLite-WAL-blue) ![node-pty](https://img.shields.io/badge/node--pty-terminal-green) ![License](https://img.shields.io/badge/license-MIT-blue)

## Features

- **Full terminal in the browser** — xterm.js connected to real Claude CLI via WebSocket + node-pty
- **Multi-user auth** — registration with admin approval (via panel or email), guest access via code, role-based permissions (admin / user / guest)
- **Admin panel** — manage users, approve/reject registrations, change roles — no SMTP required
- **Global chat** — persistent messages with markdown, file/image attachments, media gallery, real-time delivery via WebSocket
- **Multi-session** — create, stop, resume, rename, delete sessions with loading states
- **File manager** — browse, download, rename, delete files in session directories; recursive search; bulk zip-download
- **Presence** — Figma/Miro-like cursors with absolute content positioning, edge indicators for off-screen cursors (click to scroll), live chat bubbles, session avatars via WebSocket
- **Image paste** — Ctrl+V images from clipboard directly into Claude CLI (via X11 bridge)
- **Mobile-first** — adaptive layout throughout: sidebar drawer, touch-friendly targets, chat overlay
- **404 page** — Aceternity Lamp effect, because even errors should look good

## Prerequisites

- **Linux** (Ubuntu 22+ recommended)
- **Node.js 20+** (Ubuntu ships Node 18 — use nvm)
  ```bash
  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
  source ~/.bashrc
  nvm install 20
  ```
- **build-essential** + **python3** (for native modules: node-pty, better-sqlite3)
  ```bash
  sudo apt install -y build-essential python3
  ```
- **Xvfb** + **xclip** (optional, for image clipboard bridge)
  ```bash
  sudo apt install -y xvfb xclip
  ```
- **Claude CLI** installed and authenticated
  ```bash
  npm install -g @anthropic-ai/claude-code
  claude  # run once to authenticate
  ```
- **Active Anthropic subscription** (Claude Pro / Max / Team)

## Quick Start

### 1. Clone and install

```bash
git clone https://github.com/usatovw/claude-terminal.git
cd claude-terminal
npm install
```

### 2. Run setup wizard

```bash
node setup.js
```

The wizard will:
- Check system dependencies (Node.js, python3, Xvfb, xclip, Claude CLI)
- Create admin account (login + password)
- Configure deployment (domain or localhost)
- Optionally set up SMTP for email notifications
- Optionally enable guest access
- Generate `.env.local` with all secrets
- Seed admin user in database

### 3. Build and run

```bash
npm run build
npm run start
```

### 4. Open in browser

Go to the URL from setup (e.g. `https://your-domain.com` or `http://localhost:3000`), login with admin credentials from step 2.

New users can register — approve them via the admin panel (Users icon in the top bar) or via CLI:

```bash
node approve.js list              # List pending users
node approve.js approve <login>   # Approve a user
```

### 5. Nginx reverse proxy (production)

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

### 6. Run with PM2 (recommended)

```bash
npm install -g pm2
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

<details>
<summary>Systemd service for Xvfb (recommended for production)</summary>

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

## How it works

```
Browser (xterm.js) ←WebSocket→ server.js ←node-pty→ Claude CLI
Browser (chat UI)  ←REST+WS──→ server.js ←────────→ SQLite (messages, users)
Browser (presence) ←WebSocket→ server.js ←────────→ PresenceManager (cursors, peers)
                                    ↑
                               Next.js API routes
                               (auth, sessions, files, chat, admin)
```

1. **server.js** starts HTTP server with Next.js + WebSocket, loads `.env.local`, validates config, initializes SQLite DB
2. Users register → admin approves via admin panel (or email if SMTP configured)
3. On login, JWT token with user identity is issued (httpOnly cookie)
4. Terminal sessions connect via WebSocket, PTY spawned by **terminal-manager.js**
5. Chat messages stored in SQLite, broadcast to all peers via presence WebSocket
6. Image paste uses X11 clipboard bridge (Xvfb + xclip on DISPLAY :99)
7. File manager reads session directories via REST API

## User management

### Admin panel (web UI)

Click the Users icon in the top bar (visible to admins only). From there you can:
- Approve or reject pending registrations
- Change user roles (admin / user)
- Delete users

### CLI tools

```bash
node approve.js list                         # List all users
node approve.js approve <login>              # Approve a pending user
node approve.js reject <login>               # Reject a user
node approve.js create-admin <login> <pass>  # Create admin user (emergency)
```

### Email notifications (optional)

If SMTP is configured in `.env.local`, registration notifications are sent to the admin email with one-click approve/reject links. Without SMTP, use the admin panel or CLI.

## Health check

```bash
curl http://localhost:3000/api/health
# {"status":"ok","uptime":12345.678}
```

## Updating

```bash
git pull
npm install
npm run build
pm2 restart claude-terminal
```

## Backup

Back up these files regularly:
- `data/claude-terminal.db` — database (users, messages, attachment metadata)
- `chat-uploads/` — uploaded files from chat
- `.env.local` — configuration and secrets

## Project structure

```
├── server.js                    # HTTP + WebSocket entry point
├── db.js                        # SQLite init, schema, admin seed
├── setup.js                     # Interactive setup wizard
├── approve.js                   # CLI user management utility
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
│   │   ├── dashboard/page.tsx   # Dashboard — sidebar + terminal + chat + admin
│   │   └── api/
│   │       ├── auth/            # Login, register, approve, guest, logout, ws-token
│   │       ├── admin/           # User management (admin only)
│   │       ├── chat/            # Messages (CRUD), uploads (serve), media (gallery)
│   │       └── sessions/        # Session CRUD + file operations
│   ├── components/
│   │   ├── LoginForm.tsx        # Three modes: login / register / guest
│   │   ├── Terminal.tsx         # xterm.js client + clipboard bridge
│   │   ├── SessionList.tsx      # Session sidebar + logout button
│   │   ├── Navbar.tsx           # Top bar with admin + chat toggles
│   │   ├── AdminPanel.tsx       # User management slide-over panel
│   │   ├── chat/               # ChatPanel, ChatMessage, ChatInput, DateSeparator,
│   │   │                       # MediaGallery, ImageLightbox
│   │   ├── presence/           # PresenceProvider, CursorOverlay, Cursor, EdgeIndicator, Avatars
│   │   ├── file-manager/       # FileItem, FileList, FileTableHeader, etc.
│   │   └── ui/                 # Aceternity UI components
│   └── lib/
│       ├── auth.ts             # JWT (full payload) + bcrypt
│       ├── db.ts               # TS wrapper for global.db
│       ├── email.ts            # Nodemailer for registration emails
│       ├── UserContext.tsx      # React context for user identity
│       ├── markdown.ts         # Lightweight MD→HTML renderer
│       ├── TerminalScrollContext.tsx # Terminal scroll state for absolute cursor positioning
│       ├── presence-colors.ts  # 12-color palette
│       └── presence-names.ts   # Random Russian name generator
```

See [CLAUDE.md](CLAUDE.md) for detailed architecture documentation.

## Troubleshooting

### "Run: node setup.js" on server start
The server requires `.env.local` to exist. Run `node setup.js` to create it.

### "FATAL: JWT_SECRET is missing or too short"
Your `.env.local` is missing `JWT_SECRET` or it's shorter than 32 characters. Re-run `node setup.js` or add it manually.

### Image paste doesn't work
Make sure Xvfb and xclip are installed and Xvfb is running on display :99. The server will show warnings on startup if these are missing.

### Registration stuck in "pending"
Without SMTP configured, users must be approved manually:
- Via the admin panel (Users icon in the top bar)
- Via CLI: `node approve.js approve <login>`

### Native modules fail to build (node-pty, better-sqlite3)
Install build dependencies: `sudo apt install -y build-essential python3`

### Cannot connect from other devices
By default the server listens on `127.0.0.1`. For direct access (without Nginx), set `HOST=0.0.0.0` in `.env.local` (the setup wizard does this automatically for domain deployments).

## Security

- `.env.local` contains JWT_SECRET and SMTP passwords — **never commit to git**
- `data/` contains the database with password hashes — **never commit to git**
- `chat-uploads/` contains user files — **never commit to git**
- All of the above are in `.gitignore` and will not be included in forks/clones
- Passwords stored as bcrypt hashes (one-way)
- JWT tokens carry user identity, expire after configured hours
- Login rate-limited to 5 attempts per 15 minutes per IP
- Registration rate-limited to 5 attempts per 15 minutes per IP
- WebSocket connections require valid short-lived JWT (30s)
- Cookies: httpOnly + secure + SameSite=strict in production
- Server listens on 127.0.0.1 only by default (not exposed directly)
- File API sandboxed to session directories (path traversal protection)
- Chat uploads validated by MIME type and size (50MB max)
- Registration requires admin approval — no self-service access
- Guest access requires secret code, read-only in chat
- Graceful shutdown on SIGTERM/SIGINT — PTY processes killed, DB closed

## Known limitations

- Rate limiting is stored in-memory — resets on server restart
- No database migration system — schema changes require manual ALTER TABLE or DB recreation

## License

MIT

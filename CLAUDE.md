# Claude Terminal — Project Guide

## What is this

Self-hosted web interface for Claude Code CLI. Multi-user (registration + admin approval, guest access), multi-session terminal in the browser with global persistent chat. Built for running Claude CLI on a remote server and accessing it from any device.

## Architecture

```
Browser (xterm.js) ←→ WebSocket ←→ server.js ←→ node-pty ←→ Claude CLI
                                       ↑
                                  Next.js API routes (auth, sessions, chat)

Browser (presence) ←→ WebSocket ←→ server.js ←→ PresenceManager
                                  /api/presence    (cursor, ephemeral chat, peers)

Browser (chat UI) ←→ REST API ←→ server.js ←→ ChatManager ←→ SQLite
                   ←→ WebSocket (real-time)      ↑
                                          chat_message broadcast
```

**server.js** — Custom HTTP server. Loads `.env.local`, initializes SQLite DB (`db.js`), creates TerminalManager, PresenceManager, ChatManager. Handles Next.js pages + WebSocket upgrades. JWT validation on WS upgrade returns decoded payload with user identity. Exposes globals: `global.db`, `global.terminalManager`, `global.presenceManager`, `global.chatManager`.

**db.js** — SQLite database (better-sqlite3, WAL mode). Tables: `users`, `messages`, `attachments`. Auto-creates `data/` directory. Seeds admin from env vars on first run.

**terminal-manager.js** — Manages PTY sessions. Spawns `claude` CLI via node-pty, tracks connected WebSocket clients, handles session lifecycle (create/stop/resume/delete/rename). Persists session metadata to `~/.sessions.json`.

**chat-manager.js** — Persistent global chat. Stores messages + file attachments in SQLite, broadcasts new messages to all connected presence WebSocket peers via `chat_message` event.

**Next.js App Router** — Login page (3 modes), dashboard, API routes. All API routes check JWT from cookies. DB accessed via `global.db` (set by server.js).

## Key files

| File | Purpose |
|------|---------|
| `server.js` | HTTP + WebSocket server, .env.local loader, global init |
| `db.js` | SQLite init, schema, admin seed |
| `terminal-manager.js` | PTY session manager (node-pty, xclip bridge) |
| `chat-manager.js` | Persistent chat: messages, attachments, WS broadcast |
| `src/lib/auth.ts` | JWT with full payload (userId, login, firstName, lastName, role) |
| `src/lib/db.ts` | TS wrapper — returns `global.db` set by server.js |
| `src/lib/email.ts` | Nodemailer — registration approval emails to admin |
| `src/lib/UserContext.tsx` | React context — user identity from `/api/auth/check` |
| `src/lib/markdown.ts` | Lightweight MD→HTML (bold, italic, code, links) |
| `src/lib/presence-colors.ts` | 12-color palette for cursors and chat avatars |
| `src/lib/presence-names.ts` | Random Russian name generator (adjective + animal) |
| `src/middleware.ts` | Route protection (redirect to login) |
| `src/app/api/auth/route.ts` | Login — DB lookup, status check, rate-limited |
| `src/app/api/auth/register/route.ts` | Registration — bcrypt, email to admin |
| `src/app/api/auth/approve/route.ts` | Email link handler — approve/reject user |
| `src/app/api/auth/guest/route.ts` | Guest login via secret code |
| `src/app/api/auth/check/route.ts` | Auth check — returns user info from JWT |
| `src/app/api/auth/ws-token/route.ts` | Short-lived WS token with user identity |
| `src/app/api/auth/logout/route.ts` | Logout — clears cookie |
| `src/app/api/chat/messages/route.ts` | GET paginated history, POST text + files |
| `src/app/api/chat/uploads/[filename]/route.ts` | Serve uploaded files with auth |
| `src/app/api/chat/media/route.ts` | Media gallery API (images/files) |
| `src/app/api/sessions/route.ts` | List/create sessions |
| `src/app/api/sessions/[id]/route.ts` | Stop/resume/delete/rename session |
| `src/app/page.tsx` | Login page (Aurora background) |
| `src/app/dashboard/page.tsx` | Dashboard — sidebar + terminal + chat panel |
| `src/app/not-found.tsx` | 404 page (Lamp effect) |
| `src/components/LoginForm.tsx` | Three tabs: Вход / Регистрация / Гость |
| `src/components/Terminal.tsx` | xterm.js WebSocket client + clipboard bridge |
| `src/components/SessionList.tsx` | Session list with actions + logout footer |
| `src/components/Navbar.tsx` | Top bar — session info, view toggle, chat toggle |
| `src/components/chat/ChatPanel.tsx` | Right panel — messages + media gallery switch |
| `src/components/chat/ChatMessage.tsx` | Message bubble — avatar, name, text, attachments |
| `src/components/chat/ChatInput.tsx` | Auto-grow textarea, file attach, paste images |
| `src/components/chat/DateSeparator.tsx` | Date dividers (Сегодня/Вчера/DD Month) |
| `src/components/chat/MediaGallery.tsx` | Фото grid + Файлы list with infinite scroll |
| `src/components/chat/ImageLightbox.tsx` | Fullscreen image preview |
| `src/components/ui/lamp.tsx` | Aceternity Lamp effect for 404 |
| `src/components/presence/PresenceProvider.tsx` | WS client, presence + global chat context |
| `src/components/presence/CursorOverlay.tsx` | Overlay, mouse tracking, ephemeral chat |
| `src/components/presence/Cursor.tsx` | Cursor SVG + chat bubble + name tag |
| `src/components/presence/PresenceAvatars.tsx` | Session peer avatars |
| `src/components/ui/` | Aceternity UI components |
| `ecosystem.config.js` | PM2 production config |

## Auth system

Three authentication modes:

**Registered users** (role: admin | user):
1. User registers via `/api/auth/register` (firstName, lastName, login, password)
2. Server hashes password (bcrypt), inserts user with status=pending
3. Email sent to ADMIN_EMAIL with signed approve/reject links (24h JWT)
4. Admin clicks link → `/api/auth/approve` updates status
5. User can now login → JWT with full payload → httpOnly cookie
6. Rate limiting: 5 login attempts per 15 min per IP

**Guest access** (role: guest):
1. User enters secret GUEST_ACCESS_CODE
2. Server creates JWT with userId=0, random Russian name, role=guest
3. Guests can view sessions, see chat, but cannot send messages

**JWT payload**: `{ userId, login, firstName, lastName, role }`
- Auth cookie: 24h (users), 12h (guests)
- WS token: 30s, carries same user identity
- server.js `verifyJWT()` returns decoded payload (not boolean)

## Global chat

Persistent chat stored in SQLite, separate from ephemeral presence chat bubbles.

**Backend** (`chat-manager.js`): INSERT message + attachments → broadcast `chat_message` to all presence WS peers. Supports text + file uploads (images, PDFs, docs, zip — 50MB max). Files stored in `chat-uploads/` with UUID filenames.

**Frontend** (`ChatPanel`): right overlay panel (slide from right, AnimatePresence). Initial load via GET `/api/chat/messages?limit=50`. Real-time via `chat_message` WS event from PresenceProvider. Infinite scroll up for older messages. Optimistic send.

**ChatMessage**: avatar (first letter, presence color), colored author name, markdown-rendered text, inline image thumbnails (clickable → lightbox), file download links.

**ChatInput**: auto-growing textarea (max 4 lines), Enter to send, Shift+Enter newline. File attach button + clipboard paste for images. Disabled for guests with tooltip.

**MediaGallery**: toggle from chat header. Two tabs — Фото (3-col grid) / Файлы (list with download). Infinite scroll.

## Clipboard image bridge

Problem: Claude CLI reads images from X11 clipboard, but the browser has no X11 access.

Solution:
1. User Ctrl+V → `paste` event intercepted in capture phase (Terminal.tsx)
2. If image: base64 sent via WebSocket `{type: "image"}`
3. Server pipes image to `xclip -selection clipboard` on virtual display (DISPLAY=:99 via Xvfb)
4. Server sends `\x16` (Ctrl+V) to PTY → Claude CLI reads X11 clipboard
5. If text: paste event propagates to xterm.js naturally

## Presence system

Figma-like multi-user presence. Separate WebSocket endpoint `/api/presence`.

**Server** (`presence-manager.js`): tracks peers per session, broadcasts cursor positions, chat messages, and peer lists. Round-robin 12-color assignment. Name comes from JWT token (real name for registered users, random for guests).

**Client** (`PresenceProvider`): connects via WebSocket with short-lived token. Waits for UserContext to load before connecting (so name is correct). Exposes context: peers, chatMessages, globalChatMessages, sendCursor, sendChat, sendChatClose, joinSession.

**Cursor component**: single unified component with flex auto-layout (SVG cursor → chat bubble → name tag). Chat bubble appears on "/" key press with blur animation. Text broadcasts live on each keystroke. Auto-close after 5s inactivity. Name tag hidden for local user.

## Conventions

- UI language: Russian
- Dark theme, Aceternity UI components (aurora-background, hover-border-gradient, spotlight, typewriter, flip-words, text-generate, moving-border, lamp)
- Mobile-first responsive (sidebar drawer on mobile, static on desktop)
- Sessions stored in `~/projects/Claude/{session-id}/` directories
- Session IDs are timestamps: `DD-MM-YYYY-HH-MM-SS`
- DB access in API routes: `getDb()` returns `global.db` (set by server.js, NOT require)
- Chat uploads in `chat-uploads/` with UUID filenames, served via `/api/chat/uploads/[filename]`

## Database schema

```sql
users: id, login (UNIQUE), password_hash, first_name, last_name,
       role (admin|user|guest), status (pending|approved|rejected),
       color_index, created_at

messages: id, user_id (FK→users), text, created_at

attachments: id, message_id (FK→messages CASCADE), file_path,
             original_name, mime_type, size, created_at
```

## Environment

Requires on the host:
- Node.js 18+
- Claude CLI installed at `/usr/bin/claude` with active subscription
- Xvfb running on DISPLAY :99 (for clipboard bridge)
- xclip installed
- Nginx (reverse proxy with WebSocket support)

Env vars (`.env.local`):
- `JWT_SECRET` — random 64-byte hex
- `SESSION_TIMEOUT_HOURS` — JWT expiry (default 24)
- `GUEST_ACCESS_CODE` — secret code for guest access
- `ADMIN_EMAIL` — receives registration approval emails
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` — email sending
- `APP_URL` — public URL for email links

## Dev commands

```bash
npm run dev      # Development (auto-reload)
npm run build    # Production build
npm run start    # Production server
npm run lint     # ESLint
```

# Claude Terminal — Project Guide

## What is this

Self-hosted web interface for Claude Code CLI. Single-user (password auth), multi-session terminal in the browser. Built for running Claude CLI on a remote server and accessing it from any device.

## Architecture

```
Browser (xterm.js) ←→ WebSocket ←→ server.js ←→ node-pty ←→ Claude CLI
                                       ↑
                                  Next.js API routes (auth, sessions)

Browser (presence) ←→ WebSocket ←→ server.js ←→ PresenceManager
                                  /api/presence    (cursor, chat, peers)
```

**server.js** — Custom HTTP server. Handles Next.js pages + WebSocket upgrades for terminal connections. JWT validation on WS upgrade.

**terminal-manager.js** — Manages PTY sessions. Spawns `claude` CLI via node-pty, tracks connected WebSocket clients, handles session lifecycle (create/stop/resume/delete/rename). Persists session metadata to `~/.sessions.json`.

**Next.js App Router** — Login page, dashboard, API routes. All API routes check JWT from cookies.

## Key files

| File | Purpose |
|------|---------|
| `server.js` | HTTP + WebSocket server entry point |
| `terminal-manager.js` | PTY session manager (node-pty, xclip bridge) |
| `src/lib/auth.ts` | JWT + bcrypt auth helpers |
| `src/middleware.ts` | Route protection (redirect to login) |
| `src/app/api/auth/route.ts` | Login endpoint (rate-limited) |
| `src/app/api/sessions/route.ts` | List/create sessions |
| `src/app/api/sessions/[id]/route.ts` | Stop/resume/delete/rename session |
| `src/app/page.tsx` | Login page (Aurora background) |
| `src/app/dashboard/page.tsx` | Main dashboard — sidebar + terminal |
| `src/components/Terminal.tsx` | xterm.js WebSocket client + clipboard bridge |
| `src/components/SessionList.tsx` | Session list with actions |
| `src/components/Navbar.tsx` | Top bar (session name, status, sidebar toggle) |
| `src/components/ui/` | Aceternity UI components |
| `presence-manager.js` | Server-side presence: peers, cursors, chat broadcast |
| `src/components/presence/PresenceProvider.tsx` | WebSocket client, presence state context |
| `src/components/presence/CursorOverlay.tsx` | Overlay layer, mouse tracking, chat open/close |
| `src/components/presence/Cursor.tsx` | Unified cursor SVG + chat bubble + name tag |
| `src/components/presence/PresenceAvatars.tsx` | Session peer avatars in navbar |
| `src/lib/presence-colors.ts` | 12-color palette for cursors |
| `ecosystem.config.js` | PM2 production config |

## Auth flow

1. User POSTs username+password to `/api/auth`
2. bcrypt compares against `PASSWORD_HASH` env var
3. JWT created, stored in httpOnly secure cookie
4. Middleware redirects unauthenticated users from `/dashboard` to `/`
5. WebSocket connections require short-lived JWT token (fetched via `/api/auth/ws-token`)
6. Rate limiting: 5 login attempts per 15 min per IP

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

**Server** (`presence-manager.js`): tracks peers per session, broadcasts cursor positions, chat messages, and peer lists. Round-robin 12-color assignment.

**Client** (`PresenceProvider`): connects via WebSocket with short-lived token. Exposes context: peers, chatMessages, sendCursor, sendChat, sendChatClose, joinSession.

**Cursor component**: single unified component with flex auto-layout (SVG cursor → chat bubble → name tag). Chat bubble appears on "/" key press with blur animation. Text broadcasts live on each keystroke. Auto-close after 5s inactivity. Name tag hidden for local user.

**Chat flow**: "/" opens input → keystrokes broadcast via `chat` message → Enter submits (bubble stays 5s for observers) → Escape/blur/inactivity closes and sends `chat_close`.

## Conventions

- UI language: Russian
- Dark theme, Aceternity UI components
- Mobile-first responsive (sidebar drawer on mobile, static on desktop)
- Sessions stored in `~/projects/Claude/{session-id}/` directories
- Session IDs are timestamps: `DD-MM-YYYY-HH-MM-SS`

## Environment

Requires on the host:
- Node.js 18+
- Claude CLI installed at `/usr/bin/claude` with active subscription
- Xvfb running on DISPLAY :99 (for clipboard bridge)
- xclip installed
- Nginx (reverse proxy with WebSocket support)

## Dev commands

```bash
npm run dev      # Development (auto-reload)
npm run build    # Production build
npm run start    # Production server
npm run lint     # ESLint
```

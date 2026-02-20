# Claude Terminal — Project Guide

## What is this

Self-hosted web interface for Claude Code CLI. Single-user (password auth), multi-session terminal in the browser. Built for running Claude CLI on a remote server and accessing it from any device.

## Architecture

```
Browser (xterm.js) ←→ WebSocket ←→ server.js ←→ node-pty ←→ Claude CLI
                                       ↑
                                  Next.js API routes (auth, sessions)
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

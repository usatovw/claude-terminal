"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { Terminal as XTerm } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import "@xterm/xterm/css/xterm.css";
import { useTheme } from "@/lib/ThemeContext";
import { themeConfigs } from "@/lib/theme-config";
import { useTerminalScroll } from "@/lib/TerminalScrollContext";
import { getOS } from "@/lib/useOS";

const MAX_AUTH_FAILURES = 10;

interface TerminalProps {
  sessionId: string;
  fullscreen?: boolean;
  onConnectionChange?: (status: "connected" | "disconnected") => void;
}

export default function Terminal({ sessionId, fullscreen, onConnectionChange }: TerminalProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const initRef = useRef(false);
  const unmountedRef = useRef(false);
  const isConnectingRef = useRef(false);
  const isReconnectRef = useRef(false);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptRef = useRef(0);
  const authFailureCountRef = useRef(0);
  const dataDisposableRef = useRef<{ dispose: () => void } | null>(null);
  const [reconnecting, setReconnecting] = useState(false);
  const [authExpired, setAuthExpired] = useState(false);
  const { theme } = useTheme();
  const themeRef = useRef(theme);
  themeRef.current = theme;

  const { updateScroll, registerScrollFn } = useTerminalScroll();
  const updateScrollRef = useRef(updateScroll);
  updateScrollRef.current = updateScroll;
  const registerScrollFnRef = useRef(registerScrollFn);
  registerScrollFnRef.current = registerScrollFn;

  const onConnectionChangeRef = useRef(onConnectionChange);
  onConnectionChangeRef.current = onConnectionChange;

  // Update terminal theme when theme changes
  useEffect(() => {
    if (xtermRef.current) {
      xtermRef.current.options.theme = themeConfigs[theme].terminal;
    }
  }, [theme]);

  // Refit xterm when fullscreen changes
  useEffect(() => {
    if (!fitAddonRef.current || !xtermRef.current) return;
    const fitAddon = fitAddonRef.current;
    const term = xtermRef.current;

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        fitAddon.fit();
        const ws = wsRef.current;
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(
            JSON.stringify({
              type: "resize",
              cols: term.cols,
              rows: term.rows,
            })
          );
        }
        updateScrollRef.current({
          viewportY: term.buffer.active.viewportY,
          rows: term.rows,
          totalLines: term.buffer.active.length,
        });
      });
    });
  }, [fullscreen]);

  // Schedule reconnect with exponential backoff
  const scheduleReconnect = useCallback(() => {
    if (unmountedRef.current) return;
    setReconnecting(true);
    const attempt = reconnectAttemptRef.current++;
    const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
    reconnectTimerRef.current = setTimeout(() => {
      connectWs();
    }, delay);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Connect/reconnect WebSocket (separate from terminal init)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const connectWs = useCallback(async () => {
    const term = xtermRef.current;
    if (!term || !sessionId || unmountedRef.current) return;

    // Guard: prevent concurrent connectWs calls
    if (isConnectingRef.current) return;
    isConnectingRef.current = true;

    try {
      // Close any existing WebSocket before creating a new one
      if (wsRef.current) {
        const oldWs = wsRef.current;
        oldWs.onclose = null; // Prevent old onclose from triggering reconnect
        oldWs.onmessage = null;
        oldWs.onerror = null;
        if (oldWs.readyState === WebSocket.OPEN || oldWs.readyState === WebSocket.CONNECTING) {
          oldWs.close();
        }
        wsRef.current = null;
      }

      const tokenRes = await fetch("/api/auth/ws-token");
      if (!tokenRes.ok) {
        // Token fetch failed (likely auth expired)
        authFailureCountRef.current++;
        onConnectionChangeRef.current?.("disconnected");

        if (authFailureCountRef.current >= MAX_AUTH_FAILURES) {
          setAuthExpired(true);
          setReconnecting(false);
          return;
        }

        // Keep retrying — cookie might refresh from another tab
        scheduleReconnect();
        return;
      }

      // Auth succeeded, reset failure counter
      authFailureCountRef.current = 0;
      setAuthExpired(false);

      const { token } = await tokenRes.json();
      if (unmountedRef.current) return;

      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${protocol}//${window.location.host}/api/terminal?sessionId=${encodeURIComponent(sessionId)}&token=${encodeURIComponent(token)}`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        reconnectAttemptRef.current = 0;
        setReconnecting(false);
        onConnectionChangeRef.current?.("connected");

        // On reconnect: clear terminal and let server send fresh buffer
        if (isReconnectRef.current) {
          term.clear();
          isReconnectRef.current = false;
        }

        // Send current terminal size
        ws.send(
          JSON.stringify({
            type: "resize",
            cols: term.cols,
            rows: term.rows,
          })
        );
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          switch (message.type) {
            case "output":
              term.write(message.data);
              break;
            case "exit":
              term.write(
                "\r\n\x1b[90m--- Сессия остановлена ---\x1b[0m\r\n"
              );
              break;
            case "stopped":
              term.write(
                "\x1b[90m--- Сессия остановлена. Нажмите \"Возобновить\" в боковой панели. ---\x1b[0m\r\n"
              );
              break;
            case "error":
              term.write(
                `\r\n\x1b[31m${message.message}\x1b[0m\r\n`
              );
              break;
          }
        } catch {
          term.write(event.data);
        }
      };

      ws.onclose = (event) => {
        onConnectionChangeRef.current?.("disconnected");
        wsRef.current = null;

        // Don't reconnect if component unmounting
        if (unmountedRef.current) return;
        // Don't reconnect on explicit auth/session errors
        if (event.code === 4401 || event.code === 4404) return;

        // Mark as reconnecting for buffer dedup on next connect
        isReconnectRef.current = true;
        scheduleReconnect();
      };

      // Dispose old onData listener and register new one
      dataDisposableRef.current?.dispose();
      dataDisposableRef.current = term.onData((data) => {
        // Filter terminal query responses (DA1, DA2, DA3, CPR) —
        // xterm.js auto-replies to tmux capability probes; echoing them
        // back into the PTY produces visible garbage like [?1;2c
        if (/^\x1b\[[\?>=]/.test(data) || /^\x1b\[\d+;\d+R$/.test(data)) return;
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: "input", data }));
        }
      });
    } catch {
      // Network error fetching token — retry
      if (unmountedRef.current) return;
      isReconnectRef.current = true;
      scheduleReconnect();
    } finally {
      isConnectingRef.current = false;
    }
  }, [sessionId, scheduleReconnect]);

  // Initialize terminal ONCE, then connect WebSocket
  const initTerminal = useCallback(async () => {
    if (!terminalRef.current || !sessionId) return;

    const term = new XTerm({
      cursorBlink: true,
      fontSize: 14,
      fontFamily:
        "'Geist Mono', 'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
      theme: themeConfigs[themeRef.current].terminal,
      scrollback: 5000,
    });

    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();

    term.loadAddon(fitAddon);
    term.loadAddon(webLinksAddon);
    term.open(terminalRef.current);

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        fitAddon.fit();
      });
    });

    xtermRef.current = term;
    fitAddonRef.current = fitAddon;

    // Scroll tracking via xterm API
    const publishScroll = () => {
      updateScrollRef.current({
        viewportY: term.buffer.active.viewportY,
        rows: term.rows,
        totalLines: term.buffer.active.length,
      });
    };
    const scrollDisposable = term.onScroll(() => publishScroll());
    const writeDisposable = term.onWriteParsed(() => {
      requestAnimationFrame(() => publishScroll());
    });
    requestAnimationFrame(() => {
      requestAnimationFrame(() => publishScroll());
    });
    registerScrollFnRef.current((line: number) => {
      const maxLine = term.buffer.active.baseY;
      term.scrollToLine(Math.min(maxLine, Math.max(0, Math.round(line - term.rows / 2))));
    });

    // Platform-aware keyboard handling
    const isMac = getOS() === "mac";

    const copyText = (text: string) => {
      if (navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(text).catch(() => {});
      } else {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.left = "-9999px";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
    };

    term.attachCustomKeyEventHandler((e: KeyboardEvent) => {
      if (e.type !== "keydown") return true;

      if (
        ((e.ctrlKey || e.metaKey) && e.code === "KeyV") ||
        (e.ctrlKey && e.shiftKey && e.code === "KeyV")
      ) {
        return false;
      }

      if (!isMac) {
        if (e.ctrlKey && e.shiftKey && e.code === "KeyC") {
          const sel = term.getSelection();
          if (sel) {
            e.preventDefault();
            copyText(sel);
            term.clearSelection();
          }
          return false;
        }

        if (e.ctrlKey && !e.shiftKey && !e.altKey && e.code === "KeyC") {
          const sel = term.getSelection();
          if (sel) {
            e.preventDefault();
            copyText(sel);
            term.clearSelection();
            return false;
          }
          return true;
        }
      }

      return true;
    });

    // Intercept paste event — uses wsRef so it works after reconnect
    const handlePaste = (e: ClipboardEvent) => {
      if (!e.clipboardData) return;

      const items = e.clipboardData.items;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith("image/")) {
          e.preventDefault();
          e.stopImmediatePropagation();
          const blob = items[i].getAsFile();
          if (!blob) return;
          const reader = new FileReader();
          reader.onload = () => {
            const base64 = (reader.result as string).split(",")[1];
            const ws = wsRef.current;
            if (ws && ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: "image", data: base64 }));
            }
          };
          reader.readAsDataURL(blob);
          return;
        }
      }
    };
    terminalRef.current.addEventListener("paste", handlePaste, true);

    // Resize handler — uses wsRef so it works after reconnect
    const handleResize = () => {
      fitAddon.fit();
      const ws = wsRef.current;
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(
          JSON.stringify({
            type: "resize",
            cols: term.cols,
            rows: term.rows,
          })
        );
      }
      requestAnimationFrame(() => publishScroll());
    };

    const resizeObserver = new ResizeObserver(handleResize);
    if (terminalRef.current) {
      resizeObserver.observe(terminalRef.current);
    }

    // Connect WebSocket
    await connectWs();

    const containerEl = terminalRef.current;
    return () => {
      unmountedRef.current = true;
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }
      containerEl?.removeEventListener("paste", handlePaste, true);
      scrollDisposable.dispose();
      writeDisposable.dispose();
      dataDisposableRef.current?.dispose();
      registerScrollFnRef.current(null);
      resizeObserver.disconnect();
      // Clean close of WebSocket
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
        wsRef.current = null;
      }
      term.dispose();
    };
  }, [sessionId, connectWs]);

  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;
    unmountedRef.current = false;

    let cleanup: (() => void) | undefined;
    initTerminal().then((fn) => {
      cleanup = fn;
    });

    return () => {
      // Don't reset initRef — prevents double init in StrictMode
      cleanup?.();
    };
  }, [initTerminal]);

  return (
    <div className="relative w-full h-full min-h-0">
      <div
        ref={terminalRef}
        className="w-full h-full min-h-0"
      />
      {reconnecting && !authExpired && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 bg-amber-500/90 text-white text-xs px-3 py-1.5 rounded-full flex items-center gap-2 animate-pulse shadow-lg">
          <div className="w-2.5 h-2.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          Переподключение...
        </div>
      )}
      {authExpired && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 bg-red-500/90 text-white text-xs px-3 py-1.5 rounded-full shadow-lg">
          Сессия истекла — обновите страницу
        </div>
      )}
    </div>
  );
}

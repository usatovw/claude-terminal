"use client";

import { useEffect, useRef, useCallback } from "react";
import { Terminal as XTerm } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import "@xterm/xterm/css/xterm.css";
import { useTheme } from "@/lib/ThemeContext";
import { themeConfigs } from "@/lib/theme-config";
import { useTerminalScroll } from "@/lib/TerminalScrollContext";

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
  const { theme } = useTheme();
  const themeRef = useRef(theme);
  themeRef.current = theme;

  const { updateScroll, registerScrollFn } = useTerminalScroll();
  const updateScrollRef = useRef(updateScroll);
  updateScrollRef.current = updateScroll;
  const registerScrollFnRef = useRef(registerScrollFn);
  registerScrollFnRef.current = registerScrollFn;

  // Update terminal theme when theme changes
  useEffect(() => {
    if (xtermRef.current) {
      xtermRef.current.options.theme = themeConfigs[theme].terminal;
    }
  }, [theme]);

  // Refit xterm when fullscreen changes
  useEffect(() => {
    if (!fitAddonRef.current || !wsRef.current) return;
    const fitAddon = fitAddonRef.current;
    const ws = wsRef.current;
    const term = xtermRef.current;

    // Double rAF to guarantee layout + paint completed
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        fitAddon.fit();
        if (term && ws.readyState === WebSocket.OPEN) {
          ws.send(
            JSON.stringify({
              type: "resize",
              cols: term.cols,
              rows: term.rows,
            })
          );
        }
        // Publish scroll after resize so cursor positions recalculate with new rows
        if (term) {
          updateScrollRef.current({
            viewportY: term.buffer.active.viewportY,
            rows: term.rows,
            totalLines: term.buffer.active.length,
          });
        }
      });
    });
  }, [fullscreen]);

  const connectTerminal = useCallback(async () => {
    if (!terminalRef.current || !sessionId) return;

    const tokenRes = await fetch("/api/auth/ws-token");
    if (!tokenRes.ok) return;
    const { token } = await tokenRes.json();

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

    // Scroll tracking via xterm API (xterm v6 uses custom scrollbar, not native scrollTop)
    const publishScroll = () => {
      updateScrollRef.current({
        viewportY: term.buffer.active.viewportY,
        rows: term.rows,
        totalLines: term.buffer.active.length,
      });
    };
    // onScroll fires AFTER viewportY is updated — safe to read directly
    const scrollDisposable = term.onScroll(() => publishScroll());
    // onWriteParsed fires BEFORE xterm auto-scrolls (auto-scroll is deferred to RAF)
    // → defer our read to next frame so viewportY reflects the auto-scroll
    const writeDisposable = term.onWriteParsed(() => {
      requestAnimationFrame(() => publishScroll());
    });
    // Defer initial publish until after fitAddon.fit() completes (double RAF)
    requestAnimationFrame(() => {
      requestAnimationFrame(() => publishScroll());
    });
    registerScrollFnRef.current((line: number) => {
      const maxLine = term.buffer.active.baseY;
      term.scrollToLine(Math.min(maxLine, Math.max(0, Math.round(line - term.rows / 2))));
    });

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/api/terminal?sessionId=${encodeURIComponent(sessionId)}&token=${encodeURIComponent(token)}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      onConnectionChange?.("connected");
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

    ws.onclose = () => {
      onConnectionChange?.("disconnected");
    };

    term.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "input", data }));
      }
    });

    // Block xterm from sending \x16 on Ctrl+V — we handle paste via paste event
    term.attachCustomKeyEventHandler((e: KeyboardEvent) => {
      if (e.type === "keydown" && (e.ctrlKey || e.metaKey) && e.key === "v") {
        return false; // Block xterm, let browser fire paste event naturally
      }
      return true;
    });

    // Intercept paste event in CAPTURE phase (before xterm's handler)
    // paste event has fresh, synchronous clipboard data — no stale cache issues
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
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: "image", data: base64 }));
            }
          };
          reader.readAsDataURL(blob);
          return;
        }
      }
      // No image — let paste event propagate to xterm for normal text paste
    };
    terminalRef.current.addEventListener("paste", handlePaste, true);

    const handleResize = () => {
      fitAddon.fit();
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(
          JSON.stringify({
            type: "resize",
            cols: term.cols,
            rows: term.rows,
          })
        );
      }
      // Defer to next frame so layout has settled after fit
      requestAnimationFrame(() => publishScroll());
    };

    const resizeObserver = new ResizeObserver(handleResize);
    if (terminalRef.current) {
      resizeObserver.observe(terminalRef.current);
    }

    const containerEl = terminalRef.current;
    return () => {
      containerEl?.removeEventListener("paste", handlePaste, true);
      scrollDisposable.dispose();
      writeDisposable.dispose();
      registerScrollFnRef.current(null);
      resizeObserver.disconnect();
      ws.close();
      term.dispose();
    };
  }, [sessionId, onConnectionChange]);

  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    let cleanup: (() => void) | undefined;
    connectTerminal().then((fn) => {
      cleanup = fn;
    });

    return () => {
      initRef.current = false;
      cleanup?.();
    };
  }, [connectTerminal]);

  return (
    <div
      ref={terminalRef}
      className="w-full h-full min-h-0"
    />
  );
}

"use client";

import { useEffect, useRef, useCallback } from "react";
import { Terminal as XTerm } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import "@xterm/xterm/css/xterm.css";

interface TerminalProps {
  sessionId: string;
  onConnectionChange?: (status: "connected" | "disconnected") => void;
}

export default function Terminal({ sessionId, onConnectionChange }: TerminalProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const initRef = useRef(false);

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
      theme: {
        background: "#0a0a0a",
        foreground: "#e0e0e0",
        cursor: "#ffffff",
        selectionBackground: "#264f78",
        black: "#1a1a2e",
        red: "#ff6b6b",
        green: "#51cf66",
        yellow: "#ffd43b",
        blue: "#748ffc",
        magenta: "#cc5de8",
        cyan: "#66d9e8",
        white: "#e0e0e0",
        brightBlack: "#495057",
        brightRed: "#ff8787",
        brightGreen: "#69db7c",
        brightYellow: "#ffe066",
        brightBlue: "#91a7ff",
        brightMagenta: "#e599f7",
        brightCyan: "#99e9f2",
        brightWhite: "#ffffff",
      },
      scrollback: 5000,
    });

    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();

    term.loadAddon(fitAddon);
    term.loadAddon(webLinksAddon);
    term.open(terminalRef.current);

    requestAnimationFrame(() => {
      fitAddon.fit();
    });

    xtermRef.current = term;
    fitAddonRef.current = fitAddon;

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
    };

    const resizeObserver = new ResizeObserver(handleResize);
    if (terminalRef.current) {
      resizeObserver.observe(terminalRef.current);
    }

    return () => {
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
      className="w-full h-full min-h-[400px]"
      style={{ padding: "4px" }}
    />
  );
}

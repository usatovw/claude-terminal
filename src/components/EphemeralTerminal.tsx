"use client";

import { useEffect, useRef, useCallback } from "react";
import { Terminal as XTerm } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";
import { useTheme } from "@/lib/ThemeContext";
import { themeConfigs } from "@/lib/theme-config";

interface EphemeralTerminalProps {
  ephemeralId: string;
}

export default function EphemeralTerminal({ ephemeralId }: EphemeralTerminalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const initRef = useRef(false);
  const { theme } = useTheme();
  const themeRef = useRef(theme);
  themeRef.current = theme;

  const connect = useCallback(async () => {
    if (!containerRef.current || !ephemeralId) return;

    const tokenRes = await fetch("/api/auth/ws-token");
    if (!tokenRes.ok) return;
    const { token } = await tokenRes.json();

    const term = new XTerm({
      cursorBlink: true,
      fontSize: 13,
      fontFamily: "'Geist Mono', 'JetBrains Mono', 'Fira Code', monospace",
      theme: themeConfigs[themeRef.current].terminal,
      scrollback: 1000,
      rows: 10,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(containerRef.current);

    requestAnimationFrame(() => {
      requestAnimationFrame(() => fitAddon.fit());
    });

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/api/terminal?sessionId=${encodeURIComponent(ephemeralId)}&token=${encodeURIComponent(token)}&ephemeral=true`;
    const ws = new WebSocket(wsUrl);

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === "output") term.write(msg.data);
        else if (msg.type === "exit") {
          term.write("\r\n\x1b[90m--- Сессия завершена ---\x1b[0m\r\n");
        }
      } catch {
        term.write(event.data);
      }
    };

    term.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "input", data }));
      }
    });

    const resizeObserver = new ResizeObserver(() => {
      fitAddon.fit();
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "resize", cols: term.cols, rows: term.rows }));
      }
    });
    if (containerRef.current) resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      ws.close();
      term.dispose();
    };
  }, [ephemeralId]);

  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    let cleanup: (() => void) | undefined;
    connect().then((fn) => { cleanup = fn; });

    return () => {
      initRef.current = false;
      cleanup?.();
    };
  }, [connect]);

  // Cleanup ephemeral session on unmount
  useEffect(() => {
    return () => {
      if (ephemeralId) {
        fetch("/api/ephemeral", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId: ephemeralId }),
        }).catch(() => {});
      }
    };
  }, [ephemeralId]);

  return (
    <div
      ref={containerRef}
      className="w-full rounded-lg overflow-hidden border border-border"
      style={{ height: 200, backgroundColor: themeConfigs[theme].terminal.background }}
    />
  );
}

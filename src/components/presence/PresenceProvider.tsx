"use client";

import { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import { generateName } from "@/lib/presence-names";

interface Peer {
  peerId: string;
  name: string;
  colorIndex: number;
  cursor?: { x: number; y: number; timestamp: number };
  chat?: string | null;
}

interface PresenceContextValue {
  myPeerId: string;
  myName: string;
  myColorIndex: number;
  peers: Map<string, Peer>;
  sessionPeers: Record<string, Peer[]>;
  sendCursor: (x: number, y: number) => void;
  sendChat: (text: string) => void;
  sendChatClose: () => void;
  joinSession: (sessionId: string) => void;
  connected: boolean;
}

const PresenceContext = createContext<PresenceContextValue | null>(null);

export function usePresence() {
  const ctx = useContext(PresenceContext);
  if (!ctx) throw new Error("usePresence must be used within PresenceProvider");
  return ctx;
}

function generatePeerId() {
  return "p-" + Math.random().toString(36).slice(2, 11) + Date.now().toString(36);
}

export default function PresenceProvider({ children }: { children: React.ReactNode }) {
  const peerIdRef = useRef(generatePeerId());
  const nameRef = useRef(generateName());
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentSessionRef = useRef<string | null>(null);
  const lastCursorSendRef = useRef(0);

  const [myColorIndex, setMyColorIndex] = useState(0);
  const [peers, setPeers] = useState<Map<string, Peer>>(new Map());
  const [sessionPeers, setSessionPeers] = useState<Record<string, Peer[]>>({});
  const [connected, setConnected] = useState(false);

  const connect = useCallback(async () => {
    try {
      const tokenRes = await fetch("/api/auth/ws-token");
      if (!tokenRes.ok) return;
      const { token } = await tokenRes.json();

      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${protocol}//${window.location.host}/api/presence?peerId=${encodeURIComponent(peerIdRef.current)}&name=${encodeURIComponent(nameRef.current)}&token=${encodeURIComponent(token)}`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnected(true);
        // Rejoin session if we had one
        if (currentSessionRef.current) {
          ws.send(JSON.stringify({ type: "join", sessionId: currentSessionRef.current }));
        }
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          switch (msg.type) {
            case "welcome":
              setMyColorIndex(msg.colorIndex);
              break;

            case "peers":
              setPeers((prev) => {
                const next = new Map(prev);
                // Remove peers no longer in session
                const peerIds = new Set(msg.peers.map((p: Peer) => p.peerId));
                for (const id of next.keys()) {
                  if (!peerIds.has(id)) next.delete(id);
                }
                // Update/add peers
                for (const p of msg.peers) {
                  if (p.peerId === peerIdRef.current) continue; // skip self
                  const existing = next.get(p.peerId);
                  next.set(p.peerId, { ...p, cursor: existing?.cursor, chat: existing?.chat });
                }
                return next;
              });
              break;

            case "cursor":
              setPeers((prev) => {
                const peer = prev.get(msg.peerId);
                if (!peer) return prev;
                const next = new Map(prev);
                next.set(msg.peerId, { ...peer, cursor: { x: msg.x, y: msg.y, timestamp: Date.now() } });
                return next;
              });
              break;

            case "chat":
              setPeers((prev) => {
                const peer = prev.get(msg.peerId);
                if (!peer) return prev;
                const next = new Map(prev);
                next.set(msg.peerId, { ...peer, chat: msg.text });
                return next;
              });
              break;

            case "chat_close":
              setPeers((prev) => {
                const peer = prev.get(msg.peerId);
                if (!peer) return prev;
                const next = new Map(prev);
                next.set(msg.peerId, { ...peer, chat: null });
                return next;
              });
              break;

            case "peer_left":
              setPeers((prev) => {
                const next = new Map(prev);
                next.delete(msg.peerId);
                return next;
              });
              break;

            case "session_peers":
              setSessionPeers(msg.sessions);
              break;
          }
        } catch {}
      };

      ws.onclose = () => {
        setConnected(false);
        wsRef.current = null;
        // Reconnect after 3 seconds
        reconnectTimerRef.current = setTimeout(() => {
          connect();
        }, 3000);
      };
    } catch {
      // Retry connection
      reconnectTimerRef.current = setTimeout(() => {
        connect();
      }, 3000);
    }
  }, []);

  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      wsRef.current?.close();
    };
  }, [connect]);

  const joinSession = useCallback((sessionId: string) => {
    currentSessionRef.current = sessionId;
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "join", sessionId }));
    }
  }, []);

  const sendCursor = useCallback((x: number, y: number) => {
    const now = Date.now();
    if (now - lastCursorSendRef.current < 50) return; // throttle 50ms
    lastCursorSendRef.current = now;
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "cursor", x, y }));
    }
  }, []);

  const sendChat = useCallback((text: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "chat", text }));
    }
  }, []);

  const sendChatClose = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "chat_close" }));
    }
  }, []);

  return (
    <PresenceContext.Provider
      value={{
        myPeerId: peerIdRef.current,
        myName: nameRef.current,
        myColorIndex,
        peers,
        sessionPeers,
        sendCursor,
        sendChat,
        sendChatClose,
        joinSession,
        connected,
      }}
    >
      {children}
    </PresenceContext.Provider>
  );
}

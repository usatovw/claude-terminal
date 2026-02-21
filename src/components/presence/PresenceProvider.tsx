"use client";

import { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import { generateName } from "@/lib/presence-names";
import { useUser } from "@/lib/UserContext";

interface Peer {
  peerId: string;
  name: string;
  colorIndex: number;
  cursor?: { x: number; y: number; timestamp: number };
}

export interface ChatMessage {
  peerId: string;
  text: string;
  colorIndex: number;
  timestamp: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface GlobalChatMessage {
  id: number;
  text: string;
  createdAt: string;
  user: {
    id: number;
    login: string;
    firstName: string;
    lastName: string;
    role: string;
    colorIndex: number;
  };
  attachments: Array<{
    id: number;
    filePath: string;
    originalName: string;
    mimeType: string;
    size: number;
  }>;
}

interface PresenceContextValue {
  myPeerId: string;
  myName: string;
  myColorIndex: number;
  peers: Map<string, Peer>;
  chatMessages: Map<string, ChatMessage>;
  sessionPeers: Record<string, Peer[]>;
  globalChatMessages: GlobalChatMessage[];
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
  const { user, loading: userLoading } = useUser();
  const peerIdRef = useRef(generatePeerId());
  const nameRef = useRef("");
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentSessionRef = useRef<string | null>(null);
  const lastCursorSendRef = useRef(0);

  // Set name from user context: real name for registered users, random for guests
  useEffect(() => {
    if (userLoading) return;
    if (user && user.role !== "guest") {
      nameRef.current = [user.firstName, user.lastName].filter(Boolean).join(" ");
    } else if (user && user.role === "guest") {
      // Guest firstName already contains a random Russian name
      nameRef.current = user.firstName;
    } else {
      nameRef.current = generateName();
    }
  }, [user, userLoading]);

  const [myColorIndex, setMyColorIndex] = useState(0);
  const [peers, setPeers] = useState<Map<string, Peer>>(new Map());
  const [chatMessages, setChatMessages] = useState<Map<string, ChatMessage>>(new Map());
  const [sessionPeers, setSessionPeers] = useState<Record<string, Peer[]>>({});
  const [globalChatMessages, setGlobalChatMessages] = useState<GlobalChatMessage[]>([]);
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
                const peerIds = new Set(msg.peers.map((p: Peer) => p.peerId));
                for (const id of next.keys()) {
                  if (!peerIds.has(id)) next.delete(id);
                }
                for (const p of msg.peers) {
                  if (p.peerId === peerIdRef.current) continue;
                  const existing = next.get(p.peerId);
                  // Preserve cursor data, but do NOT touch chat — it's in a separate map
                  next.set(p.peerId, { ...p, cursor: existing?.cursor });
                }
                return next;
              });
              break;

            case "cursor":
              setPeers((prev) => {
                const next = new Map(prev);
                const existing = next.get(msg.peerId);
                const base = existing || { peerId: msg.peerId, name: msg.name, colorIndex: msg.colorIndex };
                next.set(msg.peerId, { ...base, cursor: { x: msg.x, y: msg.y, timestamp: Date.now() } });
                return next;
              });
              break;

            case "chat": {
              const ts = Date.now();
              setChatMessages((prev) => {
                const next = new Map(prev);
                next.set(msg.peerId, {
                  peerId: msg.peerId,
                  text: msg.text,
                  colorIndex: msg.colorIndex,
                  timestamp: ts,
                });
                return next;
              });
              // Auto-remove after 5s so AnimatePresence handles exit animation
              setTimeout(() => {
                setChatMessages((prev) => {
                  const current = prev.get(msg.peerId);
                  if (current && current.timestamp === ts) {
                    const next = new Map(prev);
                    next.delete(msg.peerId);
                    return next;
                  }
                  return prev;
                });
              }, 5000);
              break;
            }

            case "chat_close":
              setChatMessages((prev) => {
                const next = new Map(prev);
                next.delete(msg.peerId);
                return next;
              });
              break;

            case "peer_left":
              setPeers((prev) => {
                const next = new Map(prev);
                next.delete(msg.peerId);
                return next;
              });
              setChatMessages((prev) => {
                if (!prev.has(msg.peerId)) return prev;
                const next = new Map(prev);
                next.delete(msg.peerId);
                return next;
              });
              break;

            case "chat_message":
              // Global persistent chat message from server
              if (msg.message) {
                setGlobalChatMessages((prev) => [...prev, msg.message]);
              }
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
        reconnectTimerRef.current = setTimeout(() => {
          connect();
        }, 3000);
      };
    } catch {
      reconnectTimerRef.current = setTimeout(() => {
        connect();
      }, 3000);
    }
  }, []);

  useEffect(() => {
    if (userLoading) return;
    connect();
    return () => {
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      wsRef.current?.close();
    };
  }, [connect, userLoading]);

  const joinSession = useCallback((sessionId: string) => {
    currentSessionRef.current = sessionId;
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "join", sessionId }));
    }
  }, []);

  const sendCursor = useCallback((x: number, y: number) => {
    const now = Date.now();
    if (now - lastCursorSendRef.current < 50) return;
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
        chatMessages,
        sessionPeers,
        globalChatMessages,
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

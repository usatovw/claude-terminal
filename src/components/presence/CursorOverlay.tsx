"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { usePresence } from "./PresenceProvider";
import Cursor from "./Cursor";

export default function CursorOverlay() {
  const {
    peers, chatMessages, myColorIndex, myName,
    sendCursor, sendChat, sendChatClose,
  } = usePresence();
  const [isMobile, setIsMobile] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatValue, setChatValue] = useState("");
  const [cursorPos, setCursorPos] = useState({ x: 50, y: 50 });
  const [showSelfCursor, setShowSelfCursor] = useState(false);
  const inactivityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Mobile check
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // Mouse tracking
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const overlay = document.getElementById("presence-overlay");
      if (!overlay) return;
      const rect = overlay.getBoundingClientRect();
      if (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom) {
        setShowSelfCursor(false);
        return;
      }
      const xPct = ((e.clientX - rect.left) / rect.width) * 100;
      const yPct = ((e.clientY - rect.top) / rect.height) * 100;
      setCursorPos({ x: xPct, y: yPct });
      setShowSelfCursor(true);
      sendCursor(xPct, yPct);
    };
    const handleMouseLeave = () => setShowSelfCursor(false);
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseleave", handleMouseLeave);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, [sendCursor]);

  // Inactivity timer
  const clearInactivityTimer = useCallback(() => {
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
      inactivityTimerRef.current = null;
    }
  }, []);

  const resetInactivityTimer = useCallback(() => {
    clearInactivityTimer();
    inactivityTimerRef.current = setTimeout(() => {
      setChatOpen(false);
      setChatValue("");
      sendChatClose();
    }, 5000);
  }, [sendChatClose, clearInactivityTimer]);

  useEffect(() => () => clearInactivityTimer(), [clearInactivityTimer]);

  // "/" keydown — open chat
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== "/") return;
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" || target.tagName === "TEXTAREA" ||
        target.closest(".xterm") || target.contentEditable === "true"
      ) return;
      e.preventDefault();
      setChatOpen(true);
      resetInactivityTimer();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [resetInactivityTimer]);

  // Mobile chat open
  useEffect(() => {
    const handler = () => { setChatOpen(true); resetInactivityTimer(); };
    document.addEventListener("presence-chat-open", handler);
    return () => document.removeEventListener("presence-chat-open", handler);
  }, [resetInactivityTimer]);

  // Chat callbacks
  const handleChatChange = useCallback((text: string) => {
    setChatValue(text);
    sendChat(text);
    resetInactivityTimer();
  }, [sendChat, resetInactivityTimer]);

  const handleChatClose = useCallback(() => {
    setChatOpen(false);
    setChatValue("");
    sendChatClose();
    clearInactivityTimer();
  }, [sendChatClose, clearInactivityTimer]);

  const handleChatSubmit = useCallback(() => {
    if (chatValue.trim()) {
      sendChat(chatValue.trim());
    }
    // Close local input but don't send chat_close — let message stay visible for others
    setChatOpen(false);
    setChatValue("");
    clearInactivityTimer();
  }, [chatValue, sendChat, clearInactivityTimer]);

  const remotePeers = Array.from(peers.values()).filter((p) => p.cursor);

  return (
    <div
      id="presence-overlay"
      className="absolute pointer-events-none z-50 overflow-hidden"
      style={{
        top: "1px",
        left: "1px",
        right: "1px",
        bottom: "1px",
        borderRadius: "calc(0.75rem * 0.96)",
      }}
    >
      {/* Self cursor */}
      <Cursor
        x={cursorPos.x}
        y={cursorPos.y}
        colorIndex={myColorIndex}
        name={myName}
        isLocal={true}
        visible={showSelfCursor}
        chatActive={chatOpen}
        chatText={chatValue}
        isMobile={isMobile}
        onChatChange={handleChatChange}
        onChatClose={handleChatClose}
        onChatSubmit={handleChatSubmit}
      />

      {/* Remote cursors */}
      {remotePeers.map((peer) => {
        const chatMsg = chatMessages.get(peer.peerId);
        return (
          <Cursor
            key={peer.peerId}
            x={peer.cursor!.x}
            y={peer.cursor!.y}
            colorIndex={peer.colorIndex}
            name={peer.name}
            isLocal={false}
            visible={true}
            chatActive={!!chatMsg}
            chatText={chatMsg?.text ?? ""}
            isMobile={isMobile}
          />
        );
      })}
    </div>
  );
}

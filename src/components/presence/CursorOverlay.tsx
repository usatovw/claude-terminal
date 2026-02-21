"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { AnimatePresence } from "motion/react";
import { usePresence } from "./PresenceProvider";
import { useTerminalScroll } from "@/lib/TerminalScrollContext";
import Cursor from "./Cursor";
import EdgeIndicator from "./EdgeIndicator";

export default function CursorOverlay() {
  const {
    peers, chatMessages, myColorIndex, myName,
    sendCursor, sendChat, sendChatClose,
  } = usePresence();
  const { scroll, scrollToLine } = useTerminalScroll();
  const scrollRef = useRef(scroll);
  scrollRef.current = scroll;

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

  // Mouse tracking — sends absolute line-based Y position
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

      // Compute distance from bottom of buffer in line units
      // Bottom-relative positioning stays synced even when clients have different buffer sizes
      const s = scrollRef.current;
      if (s.rows <= 0 || s.totalLines <= 0) return; // scroll context not ready
      const yBot = s.totalLines - (s.viewportY + (yPct / 100 * s.rows));
      sendCursor(xPct, yBot, s.rows);
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
    setChatOpen(false);
    setChatValue("");
    clearInactivityTimer();
  }, [chatValue, sendChat, clearInactivityTimer]);

  const remotePeers = Array.from(peers.values()).filter((p) => p.cursor);

  // Classify remote cursors: in-viewport vs off-screen
  const inViewport: typeof remotePeers = [];
  const edgeUp: typeof remotePeers = [];
  const edgeDown: typeof remotePeers = [];

  for (const peer of remotePeers) {
    const cursor = peer.cursor!;
    if (scroll.rows <= 0) {
      // Scroll context not ready — show all in viewport as fallback
      inViewport.push(peer);
      continue;
    }
    // Convert bottom-relative position to local line, then to viewport %
    // cursorLine = totalLines - yBot (local absolute line)
    // displayYPct = (cursorLine - viewportY) / rows * 100
    const cursorLine = scroll.totalLines - cursor.yBot;
    const displayYPct = ((cursorLine - scroll.viewportY) / scroll.rows) * 100;
    if (displayYPct < -5) {
      edgeUp.push(peer);
    } else if (displayYPct > 105) {
      edgeDown.push(peer);
    } else {
      inViewport.push(peer);
    }
  }

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

      {/* Remote cursors — in viewport */}
      {inViewport.map((peer) => {
        const cursor = peer.cursor!;
        const cursorLine = scroll.totalLines - cursor.yBot;
        const displayYPct = scroll.rows > 0
          ? ((cursorLine - scroll.viewportY) / scroll.rows) * 100
          : 50;
        const chatMsg = chatMessages.get(peer.peerId);
        return (
          <Cursor
            key={peer.peerId}
            x={cursor.x}
            y={displayYPct}
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

      {/* Edge indicators — off-screen cursors */}
      <AnimatePresence>
        {edgeUp.map((peer, i) => (
          <EdgeIndicator
            key={`edge-up-${peer.peerId}`}
            name={peer.name}
            colorIndex={peer.colorIndex}
            direction="up"
            xPct={peer.cursor!.x}
            stackIndex={i}
            onClick={() => scrollToLine(Math.round(scroll.totalLines - peer.cursor!.yBot))}
          />
        ))}
        {edgeDown.map((peer, i) => (
          <EdgeIndicator
            key={`edge-down-${peer.peerId}`}
            name={peer.name}
            colorIndex={peer.colorIndex}
            direction="down"
            xPct={peer.cursor!.x}
            stackIndex={i}
            onClick={() => scrollToLine(Math.round(scroll.totalLines - peer.cursor!.yBot))}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}

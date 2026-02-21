"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { AnimatePresence } from "motion/react";
import { usePresence } from "./PresenceProvider";
import { PRESENCE_COLORS } from "@/lib/presence-colors";
import RemoteCursor from "./RemoteCursor";
import ChatBubble from "./ChatBubble";
import ChatInput from "./ChatInput";

export default function CursorOverlay() {
  const { peers, chatMessages, myColorIndex, sendCursor } = usePresence();
  const overlayRef = useRef<HTMLDivElement>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [cursorPos, setCursorPos] = useState({ x: 50, y: 50 });
  const [showSelfCursor, setShowSelfCursor] = useState(false);
  const [overlaySize, setOverlaySize] = useState({ w: 0, h: 0 });

  const myColor = PRESENCE_COLORS[myColorIndex % PRESENCE_COLORS.length];

  // Mobile check
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // ResizeObserver to track overlay dimensions for pixel-precise positioning
  useEffect(() => {
    const el = overlayRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setOverlaySize({ w: entry.contentRect.width, h: entry.contentRect.height });
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Mouse tracking — capture on document, check if inside overlay bounds
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const overlay = overlayRef.current;
      if (!overlay) return;
      const rect = overlay.getBoundingClientRect();
      const mx = e.clientX;
      const my = e.clientY;
      if (mx < rect.left || mx > rect.right || my < rect.top || my > rect.bottom) {
        setShowSelfCursor(false);
        return;
      }
      const xPct = ((mx - rect.left) / rect.width) * 100;
      const yPct = ((my - rect.top) / rect.height) * 100;
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

  // "/" keydown handler — only when focus is NOT in terminal or input
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== "/") return;
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.closest(".xterm") ||
        target.contentEditable === "true"
      ) {
        return;
      }
      e.preventDefault();
      setChatOpen(true);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  // Mobile chat button event
  useEffect(() => {
    const handler = () => setChatOpen(true);
    document.addEventListener("presence-chat-open", handler);
    return () => document.removeEventListener("presence-chat-open", handler);
  }, []);

  const remotePeers = Array.from(peers.values()).filter((p) => p.cursor);
  const chatEntries = Array.from(chatMessages.entries());

  const handleChatClose = useCallback(() => {
    setChatOpen(false);
  }, []);

  return (
    <div
      id="presence-overlay"
      ref={overlayRef}
      className="absolute pointer-events-none z-50 overflow-hidden"
      style={{
        top: "1px",
        left: "1px",
        right: "1px",
        bottom: "1px",
        borderRadius: "calc(0.75rem * 0.96)",
      }}
    >
      {/* Layer 1: Self-cursor SVG — no name badge */}
      {!isMobile && showSelfCursor && (
        <div
          className="absolute"
          style={{
            left: `${cursorPos.x}%`,
            top: `${cursorPos.y}%`,
          }}
        >
          <svg
            width="16"
            height="20"
            viewBox="0 0 16 20"
            fill="none"
            style={{ filter: `drop-shadow(0 0 6px ${myColor.cursor}80) drop-shadow(0 1px 2px rgba(0,0,0,0.5))` }}
          >
            <path
              d="M0.5 0.5L15 10.5L7.5 11.5L4 19L0.5 0.5Z"
              fill={myColor.cursor}
              stroke="white"
              strokeWidth="0.5"
            />
          </svg>
        </div>
      )}

      {/* Layer 2: Remote cursors — SVG + name badge, NO chat bubbles */}
      {remotePeers.map((peer) => (
        <RemoteCursor key={peer.peerId} peer={peer} isMobile={isMobile} />
      ))}

      {/* Layer 3: Chat bubbles — standalone, direct children of overlay */}
      <AnimatePresence>
        {chatEntries.map(([peerId, msg]) => {
          // Find the peer's cursor position to anchor the bubble
          const peer = peers.get(peerId);
          const cx = peer?.cursor?.x ?? 50;
          const cy = peer?.cursor?.y ?? 30;
          return (
            <ChatBubble
              key={peerId}
              peerId={peerId}
              text={msg.text}
              timestamp={msg.timestamp}
              cursorX={cx}
              cursorY={cy}
              colorIndex={msg.colorIndex}
              overlayWidth={overlaySize.w}
              overlayHeight={overlaySize.h}
            />
          );
        })}
      </AnimatePresence>

      {/* Layer 4: Chat input */}
      <AnimatePresence>
        {chatOpen && (
          <ChatInput
            cursorX={cursorPos.x}
            cursorY={cursorPos.y}
            colorIndex={myColorIndex}
            isMobile={isMobile}
            onClose={handleChatClose}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

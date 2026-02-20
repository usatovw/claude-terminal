"use client";

import { useState, useEffect, useCallback } from "react";
import { AnimatePresence, motion } from "motion/react";
import { usePresence } from "./PresenceProvider";
import RemoteCursor from "./RemoteCursor";
import ChatInput from "./ChatInput";

export default function CursorOverlay() {
  const { peers, myColorIndex } = usePresence();
  const [isMobile, setIsMobile] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [cursorPos, setCursorPos] = useState({ x: 50, y: 50 });

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // Track cursor position for chat input placement
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const overlay = document.getElementById("presence-overlay");
      if (!overlay) return;
      const rect = overlay.getBoundingClientRect();
      setCursorPos({
        x: ((e.clientX - rect.left) / rect.width) * 100,
        y: ((e.clientY - rect.top) / rect.height) * 100,
      });
    };
    document.addEventListener("mousemove", handleMouseMove);
    return () => document.removeEventListener("mousemove", handleMouseMove);
  }, []);

  // "/" keydown handler — only when focus is NOT in terminal or input
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== "/") return;
      const target = e.target as HTMLElement;
      // Don't intercept if user is typing in terminal, input, textarea
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

  const handleChatClose = useCallback(() => {
    setChatOpen(false);
  }, []);

  return (
    <div
      id="presence-overlay"
      className="absolute inset-0 pointer-events-none z-20 overflow-hidden"
    >
      {remotePeers.map((peer) => (
        <RemoteCursor key={peer.peerId} peer={peer} isMobile={isMobile} />
      ))}

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

"use client";

import { useState, useEffect, useCallback } from "react";
import { PRESENCE_COLORS } from "@/lib/presence-colors";
import ChatBubble from "./ChatBubble";

interface Peer {
  peerId: string;
  name: string;
  colorIndex: number;
  cursor?: { x: number; y: number; timestamp: number };
  chat?: string | null;
}

interface RemoteCursorProps {
  peer: Peer;
  isMobile: boolean;
}

export default function RemoteCursor({ peer, isMobile }: RemoteCursorProps) {
  const [opacity, setOpacity] = useState(1);
  const color = PRESENCE_COLORS[peer.colorIndex % PRESENCE_COLORS.length];

  // Auto-hide after 5 seconds of inactivity
  useEffect(() => {
    if (!peer.cursor) return;
    setOpacity(1);
    const timer = setTimeout(() => setOpacity(0), 5000);
    return () => clearTimeout(timer);
  }, [peer.cursor?.timestamp]);

  const handleChatExpire = useCallback(() => {
    // Chat bubble handles its own expiry visually
  }, []);

  if (!peer.cursor) return null;

  if (isMobile) {
    return (
      <div
        className="absolute"
        style={{
          left: `${peer.cursor.x}%`,
          top: `${peer.cursor.y}%`,
          transition: "left 80ms linear, top 80ms linear, opacity 300ms ease",
          opacity,
          transform: "translate(-50%, -50%)",
        }}
      >
        <div
          className="w-2 h-2 rounded-full"
          style={{ backgroundColor: color.cursor }}
        />
        {peer.chat && (
          <ChatBubble text={peer.chat} colorIndex={peer.colorIndex} onExpire={handleChatExpire} />
        )}
      </div>
    );
  }

  return (
    <div
      className="absolute"
      style={{
        left: `${peer.cursor.x}%`,
        top: `${peer.cursor.y}%`,
        transition: "left 80ms linear, top 80ms linear, opacity 300ms ease",
        opacity,
      }}
    >
      {/* SVG cursor arrow */}
      <svg
        width="16"
        height="20"
        viewBox="0 0 16 20"
        fill="none"
        style={{ filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.5))" }}
      >
        <path
          d="M0.5 0.5L15 10.5L7.5 11.5L4 19L0.5 0.5Z"
          fill={color.cursor}
          stroke="white"
          strokeWidth="0.5"
        />
      </svg>

      {/* Name badge */}
      <div
        className="absolute left-4 top-4 whitespace-nowrap rounded-md px-1.5 py-0.5 text-[10px] text-white font-medium shadow-lg"
        style={{ backgroundColor: color.cursor }}
      >
        {peer.name}
      </div>

      {/* Chat bubble */}
      {peer.chat && (
        <div className="absolute left-4 top-9">
          <ChatBubble text={peer.chat} colorIndex={peer.colorIndex} onExpire={handleChatExpire} />
        </div>
      )}
    </div>
  );
}

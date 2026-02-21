"use client";

import { useState, useEffect } from "react";
import { PRESENCE_COLORS } from "@/lib/presence-colors";

interface Peer {
  peerId: string;
  name: string;
  colorIndex: number;
  cursor?: { x: number; y: number; timestamp: number };
}

interface RemoteCursorProps {
  peer: Peer;
  isMobile: boolean;
}

export default function RemoteCursor({ peer, isMobile }: RemoteCursorProps) {
  const [cursorOpacity, setCursorOpacity] = useState(1);
  const color = PRESENCE_COLORS[peer.colorIndex % PRESENCE_COLORS.length];

  // Auto-hide cursor after 5 seconds of inactivity
  useEffect(() => {
    if (!peer.cursor) return;
    setCursorOpacity(1);
    const timer = setTimeout(() => setCursorOpacity(0), 5000);
    return () => clearTimeout(timer);
  }, [peer.cursor?.timestamp]);

  if (!peer.cursor) return null;

  const x = peer.cursor.x;
  const y = peer.cursor.y;

  // Edge-aware flipping for badge
  const flipH = x > 85;
  const flipV = y > 85;

  if (isMobile) {
    return (
      <div
        className="absolute"
        style={{
          left: `${x}%`,
          top: `${y}%`,
          transition: "left 80ms linear, top 80ms linear",
          transform: "translate(-50%, -50%)",
          opacity: cursorOpacity,
          transitionProperty: "left, top, opacity",
          transitionDuration: "80ms, 80ms, 300ms",
          transitionTimingFunction: "linear, linear, ease",
        }}
      >
        <div
          className="w-2 h-2 rounded-full"
          style={{ backgroundColor: color.cursor }}
        />
      </div>
    );
  }

  return (
    <div
      className="absolute"
      style={{
        left: `${x}%`,
        top: `${y}%`,
        transition: "left 80ms linear, top 80ms linear",
      }}
    >
      {/* SVG cursor arrow */}
      <div style={{ opacity: cursorOpacity, transition: "opacity 300ms ease" }}>
        <svg
          width="16"
          height="20"
          viewBox="0 0 16 20"
          fill="none"
          style={{ filter: `drop-shadow(0 0 6px ${color.cursor}80) drop-shadow(0 1px 2px rgba(0,0,0,0.5))` }}
        >
          <path
            d="M0.5 0.5L15 10.5L7.5 11.5L4 19L0.5 0.5Z"
            fill={color.cursor}
            stroke="white"
            strokeWidth="0.5"
          />
        </svg>
      </div>

      {/* Name badge — absolutely positioned with flip logic */}
      <div
        className="absolute whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] text-white font-medium border backdrop-blur-md max-w-[150px] truncate"
        style={{
          backgroundColor: color.cursor + "30",
          borderColor: color.cursor + "50",
          boxShadow: `0 0 8px ${color.cursor}25, 0 2px 4px rgba(0,0,0,0.3)`,
          opacity: cursorOpacity,
          transition: "opacity 300ms ease",
          ...(flipH ? { right: "4px" } : { left: "4px" }),
          ...(flipV ? { bottom: "18px" } : { top: "18px" }),
        }}
      >
        {peer.name}
      </div>
    </div>
  );
}

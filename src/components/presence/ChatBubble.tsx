"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { PRESENCE_COLORS } from "@/lib/presence-colors";

interface ChatBubbleProps {
  peerId: string;
  text: string;
  timestamp: number;
  cursorX: number;
  cursorY: number;
  colorIndex: number;
  overlayWidth: number;
  overlayHeight: number;
}

export default function ChatBubble({
  text,
  timestamp,
  cursorX,
  cursorY,
  colorIndex,
  overlayWidth,
  overlayHeight,
}: ChatBubbleProps) {
  const [fading, setFading] = useState(false);
  const color = PRESENCE_COLORS[colorIndex % PRESENCE_COLORS.length];

  // Reset fade on new message (timestamp change), auto-fade after 5s
  useEffect(() => {
    setFading(false);
    const timer = setTimeout(() => setFading(true), 5000);
    return () => clearTimeout(timer);
  }, [timestamp]);

  // Convert percentage cursor position to pixels
  const cursorPx = (cursorX / 100) * overlayWidth;
  const cursorPy = (cursorY / 100) * overlayHeight;

  // Offset from cursor tip
  const offsetX = 20;
  const offsetY = 24;

  // Space available
  const spaceRight = overlayWidth - cursorPx;
  const spaceBottom = overlayHeight - cursorPy;

  const flipH = spaceRight < 500;
  const flipV = spaceBottom < 70;

  // Compute position
  const left = flipH ? cursorPx - offsetX : cursorPx + offsetX;
  const top = flipV ? cursorPy - offsetY : cursorPy + offsetY;

  // Transform to keep bubble inside bounds
  const transformX = flipH ? "-100%" : "0";
  const transformY = flipV ? "-100%" : "0";

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.92, y: 4 }}
      animate={{ opacity: fading ? 0 : 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.92, y: 4 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className="absolute pointer-events-none"
      style={{
        left: `${left}px`,
        top: `${top}px`,
        transform: `translate(${transformX}, ${transformY})`,
      }}
    >
      <div
        className="w-fit text-xs px-2.5 py-1.5 rounded-lg border backdrop-blur-md"
        style={{
          maxWidth: "64ch",
          backgroundColor: "rgba(9, 9, 11, 0.8)",
          borderColor: color.cursor + "50",
          color: color.cursor,
          boxShadow: `0 0 10px ${color.cursor}26, 0 4px 6px rgba(0,0,0,0.25)`,
          wordBreak: "break-word",
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
        }}
      >
        {text}
      </div>
    </motion.div>
  );
}

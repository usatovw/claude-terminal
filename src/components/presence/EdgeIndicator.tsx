"use client";

import { motion } from "motion/react";
import { PRESENCE_COLORS } from "@/lib/presence-colors";

interface EdgeIndicatorProps {
  name: string;
  colorIndex: number;
  direction: "up" | "down";
  xPct: number;
  stackIndex: number;
  onClick: () => void;
}

export default function EdgeIndicator({ name, colorIndex, direction, xPct, stackIndex, onClick }: EdgeIndicatorProps) {
  const color = PRESENCE_COLORS[colorIndex % PRESENCE_COLORS.length];
  const arrow = direction === "up" ? "\u2191" : "\u2193";
  const offset = 4 + stackIndex * 28;

  return (
    <motion.div
      initial={{ opacity: 0, y: direction === "up" ? -8 : 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: direction === "up" ? -8 : 8 }}
      transition={{ duration: 0.2 }}
      className="absolute pointer-events-auto cursor-pointer"
      style={{
        [direction === "up" ? "top" : "bottom"]: offset,
        left: `clamp(10%, ${xPct}%, 90%)`,
        transform: "translateX(-50%)",
      }}
      onClick={onClick}
    >
      <div
        className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] text-white font-semibold"
        style={{
          backgroundColor: color.cursor,
          boxShadow: `0 0 10px ${color.cursor}50, 0 2px 4px rgba(0,0,0,0.4)`,
        }}
      >
        <span className="max-w-[80px] truncate">{name}</span>
        <span>{arrow}</span>
      </div>
    </motion.div>
  );
}

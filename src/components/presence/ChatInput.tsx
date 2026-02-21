"use client";

import { useState, useRef, useEffect } from "react";
import { motion } from "motion/react";
import { usePresence } from "./PresenceProvider";
import { PRESENCE_COLORS } from "@/lib/presence-colors";

interface ChatInputProps {
  cursorX: number;
  cursorY: number;
  colorIndex: number;
  isMobile: boolean;
  onClose: () => void;
}

export default function ChatInput({ cursorX, cursorY, colorIndex, isMobile, onClose }: ChatInputProps) {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const { sendChat, sendChatClose } = usePresence();
  const color = PRESENCE_COLORS[colorIndex % PRESENCE_COLORS.length];

  useEffect(() => {
    requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && value.trim()) {
      sendChat(value.trim());
      onClose();
    }
    if (e.key === "Escape") {
      sendChatClose();
      onClose();
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setValue(e.target.value.slice(0, 128));
  };

  if (isMobile) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        transition={{ duration: 0.15 }}
        className="fixed bottom-4 left-4 right-4 z-25 pointer-events-auto"
      >
        <div
          className="rounded-lg p-1 border backdrop-blur-xl"
          style={{
            backgroundColor: "rgba(9, 9, 11, 0.85)",
            borderColor: color.cursor + "50",
            boxShadow: `0 0 15px ${color.cursor}20, 0 8px 16px rgba(0,0,0,0.4)`,
          }}
        >
          <input
            ref={inputRef}
            type="text"
            value={value}
            maxLength={128}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onBlur={onClose}
            placeholder="Сообщение..."
            className="bg-transparent text-sm text-zinc-200 outline-none w-full px-3 py-2"
          />
        </div>
      </motion.div>
    );
  }

  // Clamp position so input doesn't go off-screen
  const clampedX = Math.min(cursorX, 75);
  const clampedY = Math.min(cursorY, 85);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.12 }}
      className="absolute pointer-events-auto z-25"
      style={{ left: `${clampedX}%`, top: `${clampedY}%` }}
    >
      <div
        className="rounded-lg p-1 border backdrop-blur-xl"
        style={{
          backgroundColor: "rgba(9, 9, 11, 0.85)",
          borderColor: color.cursor + "50",
          boxShadow: `0 0 15px ${color.cursor}20, 0 8px 16px rgba(0,0,0,0.4)`,
        }}
      >
        <input
          ref={inputRef}
          type="text"
          value={value}
          maxLength={128}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onBlur={onClose}
          placeholder="Сообщение..."
          className="bg-transparent text-sm text-zinc-200 outline-none w-64 px-2 py-1"
        />
      </div>
    </motion.div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { PRESENCE_COLORS } from "@/lib/presence-colors";

interface ChatBubbleProps {
  text: string;
  colorIndex: number;
  onExpire: () => void;
}

export default function ChatBubble({ text, colorIndex, onExpire }: ChatBubbleProps) {
  const [visible, setVisible] = useState(true);
  const color = PRESENCE_COLORS[colorIndex % PRESENCE_COLORS.length];

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      onExpire();
    }, 10000);
    return () => clearTimeout(timer);
  }, [text, onExpire]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, scale: 0.85, y: -4 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.85 }}
          transition={{ duration: 0.15 }}
          className="mt-1 max-w-[200px] break-words"
        >
          <div
            className="text-xs px-2 py-1 rounded-lg border"
            style={{
              backgroundColor: color.cursor + "20",
              borderColor: color.cursor + "30",
              color: color.cursor,
            }}
          >
            {text}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

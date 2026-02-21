"use client";

import { useRef, useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { PRESENCE_COLORS } from "@/lib/presence-colors";

interface CursorProps {
  x: number;
  y: number;
  colorIndex: number;
  name: string;
  isLocal: boolean;
  visible: boolean;
  chatActive: boolean;
  chatText: string;
  isMobile: boolean;
  onChatChange?: (text: string) => void;
  onChatClose?: () => void;
  onChatSubmit?: () => void;
}

export default function Cursor({
  x, y, colorIndex, name, isLocal, visible,
  chatActive, chatText,
  isMobile, onChatChange, onChatClose, onChatSubmit,
}: CursorProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const color = PRESENCE_COLORS[colorIndex % PRESENCE_COLORS.length];
  const [fadeOpacity, setFadeOpacity] = useState(1);

  // Remote cursor: auto-fade after 5s of no movement
  useEffect(() => {
    if (isLocal) return;
    setFadeOpacity(1);
    const t = setTimeout(() => setFadeOpacity(0), 5000);
    return () => clearTimeout(t);
  }, [x, y, isLocal]);

  // Focus input when chat opens
  useEffect(() => {
    if (chatActive && isLocal) {
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [chatActive, isLocal]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") onChatClose?.();
    if (e.key === "Enter") onChatSubmit?.();
  };

  // --- Mobile local: fixed-bottom chat input ---
  if (isMobile && isLocal) {
    return (
      <AnimatePresence>
        {chatActive && (
          <motion.div
            key="mobile-input"
            initial={{ opacity: 0, y: 20, filter: "blur(6px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: 20, filter: "blur(6px)" }}
            transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
            className="fixed bottom-4 left-4 right-4 pointer-events-auto"
            style={{ zIndex: 30 }}
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
                value={chatText}
                maxLength={128}
                onChange={(e) => onChatChange?.(e.target.value.slice(0, 128))}
                onKeyDown={handleKeyDown}
                onBlur={onChatClose}
                placeholder="Сообщение..."
                className="bg-transparent text-sm text-zinc-200 outline-none w-full px-3 py-2"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    );
  }

  // --- Mobile remote: colored dot ---
  if (isMobile && !isLocal) {
    return (
      <div
        className="absolute"
        style={{
          left: `${x}%`,
          top: `${y}%`,
          transition: "left 80ms linear, top 80ms linear",
          transform: "translate(-50%, -50%)",
          opacity: fadeOpacity,
          transitionProperty: "left, top, opacity",
          transitionDuration: "80ms, 80ms, 300ms",
          transitionTimingFunction: "linear, linear, ease",
        }}
      >
        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color.cursor }} />
      </div>
    );
  }

  // --- Desktop ---
  if (!visible && !chatActive && isLocal) return null;

  const svgOpacity = isLocal ? (visible ? 1 : 0) : fadeOpacity;

  return (
    <div
      className="absolute"
      style={{
        left: `${x}%`,
        top: `${y}%`,
        transition: isLocal ? undefined : "left 80ms linear, top 80ms linear",
      }}
    >
      {/* Auto-layout: cursor → bubble → tag */}
      <div className="flex flex-col items-start">
        {/* 1. Cursor SVG */}
        <div style={{ opacity: svgOpacity, transition: "opacity 300ms ease" }}>
          <svg
            width="16"
            height="20"
            viewBox="0 0 16 20"
            fill="none"
            style={{
              filter: `drop-shadow(0 0 6px ${color.cursor}80) drop-shadow(0 1px 2px rgba(0,0,0,0.5))`,
            }}
          >
            <path
              d="M0.5 0.5L15 10.5L7.5 11.5L4 19L0.5 0.5Z"
              fill={color.cursor}
              stroke="white"
              strokeWidth="0.5"
            />
          </svg>
        </div>

        {/* 2. Chat bubble — hidden → visible with animation */}
        <AnimatePresence>
          {chatActive && (
            <motion.div
              key="chat"
              initial={{ opacity: 0, scale: 0.9, filter: "blur(4px)" }}
              animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
              exit={{ opacity: 0, scale: 0.9, filter: "blur(4px)" }}
              transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
              style={{ transformOrigin: "top left" }}
              className="mt-1"
            >
              <div
                className="rounded-lg border backdrop-blur-xl"
                style={{
                  backgroundColor: "rgba(9, 9, 11, 0.85)",
                  borderColor: color.cursor + "50",
                  boxShadow: `0 0 12px ${color.cursor}20, 0 4px 8px rgba(0,0,0,0.3)`,
                }}
              >
                {isLocal ? (
                  <input
                    ref={inputRef}
                    type="text"
                    value={chatText}
                    maxLength={128}
                    onChange={(e) => onChatChange?.(e.target.value.slice(0, 128))}
                    onKeyDown={handleKeyDown}
                    onBlur={onChatClose}
                    placeholder="Сообщение..."
                    className="bg-transparent text-xs text-zinc-200 outline-none w-56 px-2.5 py-1.5 pointer-events-auto"
                  />
                ) : (
                  <div
                    className="text-xs px-2.5 py-1.5"
                    style={{
                      color: color.cursor,
                      maxWidth: "64ch",
                      wordBreak: "break-word",
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                    }}
                  >
                    {chatText}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 3. Name tag — hidden for self */}
        {!isLocal && (
          <div
            className="whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] text-white font-medium border backdrop-blur-md max-w-[150px] truncate mt-1"
            style={{
              backgroundColor: color.cursor + "30",
              borderColor: color.cursor + "50",
              boxShadow: `0 0 8px ${color.cursor}25, 0 2px 4px rgba(0,0,0,0.3)`,
              opacity: fadeOpacity,
              transition: "opacity 300ms ease",
            }}
          >
            {name}
          </div>
        )}
      </div>
    </div>
  );
}

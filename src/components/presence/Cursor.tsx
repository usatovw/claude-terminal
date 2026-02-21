"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { AnimatePresence, motion } from "motion/react";
import { PRESENCE_COLORS } from "@/lib/presence-colors";
import { useTheme } from "@/lib/ThemeContext";
import { themeConfigs } from "@/lib/theme-config";

// Shared bubble constraints
const BUBBLE_MAX_W = 300;
const BUBBLE_CONTENT_W = 280; // BUBBLE_MAX_W minus px-2.5 padding (10px * 2)
const BUBBLE_MAX_LINES = 2;
const BUBBLE_LINE_H = 16; // text-xs line-height = 1rem = 16px
const BUBBLE_MAX_H = BUBBLE_MAX_LINES * BUBBLE_LINE_H;

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
  const inputRef = useRef<HTMLTextAreaElement | HTMLInputElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const color = PRESENCE_COLORS[colorIndex % PRESENCE_COLORS.length];
  const [fadeOpacity, setFadeOpacity] = useState(1);
  const { theme } = useTheme();
  const cursorTheme = themeConfigs[theme].cursor;

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

  // Check if text fits within 2 lines at max width
  const checkFits = useCallback((text: string): boolean => {
    const el = measureRef.current;
    if (!el) return true;
    el.textContent = text || "\u200B";
    return el.scrollHeight <= BUBBLE_MAX_H;
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") onChatClose?.();
    if (e.key === "Enter") { e.preventDefault(); onChatSubmit?.(); }
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
                backgroundColor: cursorTheme.bubbleBg,
                borderColor: color.cursor + cursorTheme.bubbleBorder,
                boxShadow: `0 0 15px ${color.cursor}20, 0 8px 16px rgba(0,0,0,0.4)`,
              }}
            >
              <input
                ref={inputRef as React.RefObject<HTMLInputElement>}
                type="text"
                value={chatText}
                maxLength={128}
                onChange={(e) => onChatChange?.(e.target.value.slice(0, 128))}
                onKeyDown={handleKeyDown}
                onBlur={onChatClose}
                className="bg-transparent text-sm outline-none w-full px-3 py-2"
                style={{ color: cursorTheme.textColor }}
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

  // Shared bubble content styles (identical for author & observer)
  const bubbleContentStyle = {
    maxWidth: BUBBLE_MAX_W,
    wordBreak: "break-word" as const,
    display: "-webkit-box" as const,
    WebkitLineClamp: BUBBLE_MAX_LINES,
    WebkitBoxOrient: "vertical" as const,
    overflow: "hidden" as const,
  };

  return (
    <div
      className="absolute"
      style={{
        left: `${x}%`,
        top: `${y}%`,
        transition: isLocal ? undefined : "left 80ms linear, top 80ms linear",
      }}
    >
      {/* Hidden measurement div — checks if text fits in 2 lines */}
      {isLocal && (
        <div
          ref={measureRef}
          aria-hidden
          className="text-xs"
          style={{
            position: "fixed",
            left: -9999,
            top: -9999,
            visibility: "hidden",
            width: BUBBLE_CONTENT_W,
            height: BUBBLE_MAX_H,
            overflow: "hidden",
            wordBreak: "break-word",
            lineHeight: BUBBLE_LINE_H + "px",
          }}
        />
      )}

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
                  backgroundColor: cursorTheme.bubbleBg,
                  borderColor: color.cursor + cursorTheme.bubbleBorder,
                  boxShadow: `0 0 12px ${color.cursor}20, 0 4px 8px rgba(0,0,0,0.3)`,
                }}
              >
                {isLocal ? (
                  <div className="inline-grid px-2.5 py-1.5" style={{ maxWidth: BUBBLE_MAX_W }}>
                    {/* Hidden span — determines grid cell size (hug width) */}
                    <span
                      className="invisible text-xs"
                      style={{ gridArea: "1/1", ...bubbleContentStyle }}
                    >
                      {chatText || "\u200B"}
                    </span>
                    {/* Textarea — fills grid cell exactly */}
                    <textarea
                      ref={inputRef as React.RefObject<HTMLTextAreaElement>}
                      value={chatText}
                      rows={1}
                      cols={1}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\n/g, "");
                        if (!checkFits(val)) return;
                        onChatChange?.(val);
                      }}
                      onKeyDown={handleKeyDown}
                      onBlur={onChatClose}
                      className="bg-transparent text-xs outline-none pointer-events-auto resize-none"
                      style={{
                        gridArea: "1/1",
                        width: "100%",
                        height: "100%",
                        minWidth: 0,
                        minHeight: 0,
                        overflow: "hidden",
                        wordBreak: "break-word",
                        color: cursorTheme.textColor,
                      }}
                    />
                  </div>
                ) : (
                  <div
                    className="text-xs px-2.5 py-1.5"
                    style={{ color: color.cursor, ...bubbleContentStyle }}
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
            className="whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] text-white font-semibold max-w-[150px] truncate mt-1"
            style={{
              backgroundColor: color.cursor,
              boxShadow: `0 0 10px ${color.cursor}50, 0 2px 4px rgba(0,0,0,0.4)`,
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

"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

interface TabContextMenuProps {
  x: number;
  y: number;
  onClose: () => void;
  onCloseOthers: () => void;
  onCloseAll: () => void;
  onDismiss: () => void;
}

export default function TabContextMenu({
  x,
  y,
  onClose,
  onCloseOthers,
  onCloseAll,
  onDismiss,
}: TabContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onDismiss();
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onDismiss();
    };

    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [onDismiss]);

  const items = [
    { label: "Закрыть", action: onClose },
    { label: "Закрыть остальные", action: onCloseOthers },
    { label: "Закрыть все", action: onCloseAll },
  ];

  return createPortal(
    <div
      ref={menuRef}
      className="fixed z-[100] bg-surface border border-border-strong rounded-lg shadow-xl py-1 min-w-[160px]"
      style={{ left: x, top: y }}
    >
      {items.map((item) => (
        <button
          key={item.label}
          onClick={item.action}
          className="w-full text-left px-3 py-1.5 text-xs text-foreground hover:bg-surface-hover transition-colors cursor-pointer"
        >
          {item.label}
        </button>
      ))}
    </div>,
    document.body
  );
}

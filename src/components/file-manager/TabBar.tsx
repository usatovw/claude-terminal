"use client";

import { useRef, useState, useCallback } from "react";
import { X, Plus } from "@/components/Icons";
import type { EditorTab } from "@/lib/useEditorTabs";
import TabContextMenu from "./TabContextMenu";

interface TabBarProps {
  tabs: EditorTab[];
  activeTabId: string | null;
  onSelect: (id: string) => void;
  onClose: (id: string) => void;
  onCloseOthers: (id: string) => void;
  onCloseAll: () => void;
  onAdd?: () => void;
}

export default function TabBar({
  tabs,
  activeTabId,
  onSelect,
  onClose,
  onCloseOthers,
  onCloseAll,
  onAdd,
}: TabBarProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [contextMenu, setContextMenu] = useState<{ id: string; x: number; y: number } | null>(null);

  const handleContextMenu = useCallback((e: React.MouseEvent, id: string) => {
    e.preventDefault();
    setContextMenu({ id, x: e.clientX, y: e.clientY });
  }, []);

  const handleCloseMenu = useCallback(() => setContextMenu(null), []);

  return (
    <div className="flex items-center border-b border-border bg-surface min-h-[36px]">
      <div
        ref={scrollRef}
        className="flex-1 flex items-center overflow-x-auto scrollbar-none"
        style={{ scrollbarWidth: "none" }}
      >
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId;
          return (
            <div
              key={tab.id}
              onClick={() => onSelect(tab.id)}
              onContextMenu={(e) => handleContextMenu(e, tab.id)}
              className={`group flex items-center gap-1.5 px-3 py-1.5 min-w-0 max-w-[180px] cursor-pointer border-r border-border text-xs transition-colors shrink-0 ${
                isActive
                  ? "bg-surface-alt text-foreground border-b-2 border-b-accent"
                  : "text-muted-fg hover:text-foreground hover:bg-surface-hover/50"
              }`}
            >
              {/* Dirty indicator */}
              {tab.dirty && (
                <span className="w-2 h-2 rounded-full bg-accent-fg shrink-0" />
              )}
              {/* File name (basename only, full path in tooltip) */}
              <span className="truncate select-none" title={tab.path}>
                {tab.name.includes("/") ? tab.name.split("/").pop() : tab.name}
              </span>
              {/* Close button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onClose(tab.id);
                }}
                className="ml-auto p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-surface-hover transition-all cursor-pointer shrink-0"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          );
        })}
      </div>

      {/* Add button */}
      {onAdd && (
        <button
          onClick={onAdd}
          className="p-1.5 mx-1 text-muted-fg hover:text-foreground hover:bg-surface-hover rounded transition-colors cursor-pointer shrink-0"
          title="Открыть файл"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      )}

      {/* Context menu */}
      {contextMenu && (
        <TabContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => {
            onClose(contextMenu.id);
            handleCloseMenu();
          }}
          onCloseOthers={() => {
            onCloseOthers(contextMenu.id);
            handleCloseMenu();
          }}
          onCloseAll={() => {
            onCloseAll();
            handleCloseMenu();
          }}
          onDismiss={handleCloseMenu}
        />
      )}
    </div>
  );
}

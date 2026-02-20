"use client";

import { useState, useRef, useEffect } from "react";
import { motion } from "motion/react";
import { FolderIcon, FileIcon, Download, Pencil, Trash } from "@/components/Icons";
import { formatFileSize, relativeTime } from "@/lib/utils";

export interface FileEntry {
  name: string;
  type: "file" | "directory";
  size: number;
  modifiedAt: string;
  extension: string | null;
}

interface FileItemProps {
  entry: FileEntry;
  isSelected: boolean;
  isRenaming: boolean;
  renameName: string;
  onSelect: (e: React.MouseEvent) => void;
  onNavigate: () => void;
  onDownload: () => void;
  onRenameStart: () => void;
  onRenameChange: (name: string) => void;
  onRenameSubmit: () => void;
  onRenameCancel: () => void;
  onDelete: () => void;
}

export default function FileItem({
  entry,
  isSelected,
  isRenaming,
  renameName,
  onSelect,
  onNavigate,
  onDownload,
  onRenameStart,
  onRenameChange,
  onRenameSubmit,
  onRenameCancel,
  onDelete,
}: FileItemProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [clickTimeout, setClickTimeout] = useState<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (isRenaming && inputRef.current) {
      inputRef.current.focus();
      // Select name without extension
      const dotIndex = renameName.lastIndexOf(".");
      if (dotIndex > 0 && entry.type === "file") {
        inputRef.current.setSelectionRange(0, dotIndex);
      } else {
        inputRef.current.select();
      }
    }
  }, [isRenaming, renameName, entry.type]);

  const handleClick = (e: React.MouseEvent) => {
    if (isRenaming) return;

    if (clickTimeout) {
      // Double click
      clearTimeout(clickTimeout);
      setClickTimeout(null);
      if (entry.type === "directory") {
        onNavigate();
      } else {
        onDownload();
      }
    } else {
      // Single click — wait to see if it's a double click
      const timeout = setTimeout(() => {
        setClickTimeout(null);
        onSelect(e);
      }, 250);
      setClickTimeout(timeout);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") onRenameSubmit();
    else if (e.key === "Escape") onRenameCancel();
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.15 }}
      onClick={handleClick}
      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-150 group cursor-pointer ${
        isSelected
          ? "bg-gradient-to-r from-violet-500/10 to-indigo-500/10 border border-violet-500/20"
          : "hover:bg-zinc-800/50 border border-transparent"
      }`}
    >
      {/* Icon */}
      <div className="flex-shrink-0">
        {entry.type === "directory" ? (
          <FolderIcon className="w-5 h-5 text-violet-400" />
        ) : (
          <FileIcon className="w-5 h-5 text-zinc-500" />
        )}
      </div>

      {/* Name */}
      <div className="flex-1 min-w-0">
        {isRenaming ? (
          <input
            ref={inputRef}
            type="text"
            value={renameName}
            onChange={(e) => onRenameChange(e.target.value)}
            onBlur={onRenameSubmit}
            onKeyDown={handleKeyDown}
            onClick={(e) => e.stopPropagation()}
            className="text-sm text-zinc-200 bg-zinc-900 border border-zinc-600 rounded px-2 py-0.5 w-full outline-none focus:border-violet-500/50"
          />
        ) : (
          <span className="text-sm text-zinc-300 truncate block">
            {entry.name}
          </span>
        )}
      </div>

      {/* Size */}
      <div className="hidden sm:block text-xs text-zinc-600 w-20 text-right flex-shrink-0">
        {entry.type === "file" ? formatFileSize(entry.size) : ""}
      </div>

      {/* Modified */}
      <div className="hidden md:block text-xs text-zinc-600 w-24 text-right flex-shrink-0">
        {relativeTime(entry.modifiedAt)}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
        {entry.type === "file" && (
          <button
            onClick={(e) => { e.stopPropagation(); onDownload(); }}
            className="p-1 text-zinc-500 hover:text-violet-400 transition-colors cursor-pointer"
            title="Скачать"
          >
            <Download className="w-3.5 h-3.5" />
          </button>
        )}
        <button
          onClick={(e) => { e.stopPropagation(); onRenameStart(); }}
          className="p-1 text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer"
          title="Переименовать"
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="p-1 text-zinc-500 hover:text-red-400 transition-colors cursor-pointer"
          title="Удалить"
        >
          <Trash className="w-3.5 h-3.5" />
        </button>
      </div>
    </motion.div>
  );
}

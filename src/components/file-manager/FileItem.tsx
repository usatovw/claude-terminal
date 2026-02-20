"use client";

import { useRef, useEffect } from "react";
import { motion } from "motion/react";
import { FolderIcon, FileIcon, Download, Pencil, Trash, CheckSquare, Square } from "@/components/Icons";
import { formatFileSize, relativeTime } from "@/lib/utils";

export interface FileEntry {
  name: string;
  relativePath?: string;
  type: "file" | "directory";
  size: number;
  modifiedAt: string;
  extension: string | null;
}

interface FileItemProps {
  entry: FileEntry;
  isSelected: boolean;
  isChecked: boolean;
  isRenaming: boolean;
  renameName: string;
  gridTemplateColumns: string;
  onSelect: (e: React.MouseEvent) => void;
  onCheckboxChange: () => void;
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
  isChecked,
  isRenaming,
  renameName,
  gridTemplateColumns,
  onSelect,
  onCheckboxChange,
  onNavigate,
  onDownload,
  onRenameStart,
  onRenameChange,
  onRenameSubmit,
  onRenameCancel,
  onDelete,
}: FileItemProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isRenaming && inputRef.current) {
      inputRef.current.focus();
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
    if (e.detail === 1) {
      onSelect(e);
    }
  };

  const handleDoubleClick = () => {
    if (isRenaming) return;
    if (entry.type === "directory") {
      onNavigate();
    } else {
      onDownload();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") onRenameSubmit();
    else if (e.key === "Escape") onRenameCancel();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.1 }}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      className={`grid items-center px-4 py-2 transition-all duration-150 group cursor-pointer ${
        isSelected
          ? "bg-gradient-to-r from-violet-500/10 to-indigo-500/10"
          : "hover:bg-zinc-800/50"
      }`}
      style={{ gridTemplateColumns }}
    >
      {/* Checkbox */}
      <div
        className="flex items-center justify-center"
        onClick={(e) => { e.stopPropagation(); onCheckboxChange(); }}
      >
        {isChecked ? (
          <CheckSquare className="w-4 h-4 text-violet-400" />
        ) : (
          <Square className="w-4 h-4 text-zinc-600 group-hover:text-zinc-400 transition-colors" />
        )}
      </div>

      {/* Icon */}
      <div className="flex items-center justify-center">
        {entry.type === "directory" ? (
          <FolderIcon className="w-5 h-5 text-violet-400" />
        ) : (
          <FileIcon className="w-5 h-5 text-zinc-500" />
        )}
      </div>

      {/* Name */}
      <div className="min-w-0 pr-2">
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
            {entry.relativePath && entry.relativePath !== entry.name ? (
              <>
                <span className="text-zinc-600">{entry.relativePath.slice(0, entry.relativePath.length - entry.name.length)}</span>
                {entry.name}
              </>
            ) : (
              entry.name
            )}
          </span>
        )}
      </div>

      {/* Size */}
      <div className="text-xs text-zinc-600 text-right">
        {entry.type === "file" ? formatFileSize(entry.size) : ""}
      </div>

      {/* Modified */}
      <div className="text-xs text-zinc-600 text-right">
        {relativeTime(entry.modifiedAt)}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
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

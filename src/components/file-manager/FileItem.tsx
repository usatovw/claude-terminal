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
      className={`grid items-center px-2 md:px-4 py-2.5 md:py-2 transition-all duration-150 group cursor-pointer ${
        isSelected
          ? "bg-gradient-to-r from-accent/10 to-indigo-500/10"
          : "hover:bg-surface-hover/50"
      }`}
      style={{ gridTemplateColumns }}
    >
      {/* Checkbox */}
      <div
        className="flex items-center justify-center"
        onClick={(e) => { e.stopPropagation(); onCheckboxChange(); }}
      >
        {isChecked ? (
          <CheckSquare className="w-4 h-4 text-accent-fg" />
        ) : (
          <Square className="w-4 h-4 text-muted group-hover:text-muted-fg transition-colors" />
        )}
      </div>

      {/* Icon */}
      <div className="flex items-center justify-center">
        {entry.type === "directory" ? (
          <FolderIcon className="w-5 h-5 text-accent-fg" />
        ) : (
          <FileIcon className="w-5 h-5 text-muted-fg" />
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
            className="text-sm text-foreground bg-surface-alt border border-border-strong rounded px-2 py-0.5 w-full outline-none focus:border-accent/50"
          />
        ) : (
          <span className="text-sm text-foreground truncate block">
            {entry.relativePath && entry.relativePath !== entry.name ? (
              <>
                <span className="text-muted">{entry.relativePath.slice(0, entry.relativePath.length - entry.name.length)}</span>
                {entry.name}
              </>
            ) : (
              entry.name
            )}
          </span>
        )}
      </div>

      {/* Size */}
      <div className="text-xs text-muted text-right hidden md:block">
        {entry.type === "file" ? formatFileSize(entry.size) : ""}
      </div>

      {/* Modified */}
      <div className="text-xs text-muted text-right hidden md:block">
        {relativeTime(entry.modifiedAt)}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-1 md:gap-0.5 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
        {entry.type === "file" && (
          <button
            onClick={(e) => { e.stopPropagation(); onDownload(); }}
            className="p-2 md:p-1 text-muted-fg hover:text-accent-fg transition-colors cursor-pointer"
            title="Скачать"
          >
            <Download className="w-4 h-4 md:w-3.5 md:h-3.5" />
          </button>
        )}
        <button
          onClick={(e) => { e.stopPropagation(); onRenameStart(); }}
          className="p-2 md:p-1 text-muted-fg hover:text-foreground transition-colors cursor-pointer"
          title="Переименовать"
        >
          <Pencil className="w-4 h-4 md:w-3.5 md:h-3.5" />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="p-2 md:p-1 text-muted-fg hover:text-danger transition-colors cursor-pointer"
          title="Удалить"
        >
          <Trash className="w-4 h-4 md:w-3.5 md:h-3.5" />
        </button>
      </div>
    </motion.div>
  );
}

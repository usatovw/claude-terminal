"use client";

import { Search, Download, Trash, FolderOpen } from "@/components/Icons";

export type SortField = "name" | "size" | "modifiedAt";
export type SortDirection = "asc" | "desc";

interface FileToolbarProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  selectedCount: number;
  onDownloadSelected: () => void;
  onDeleteSelected: () => void;
  singleFolderSelected: boolean;
  onEnterFolder: () => void;
}

export default function FileToolbar({
  searchQuery,
  onSearchChange,
  selectedCount,
  onDownloadSelected,
  onDeleteSelected,
  singleFolderSelected,
  onEnterFolder,
}: FileToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Search */}
      <div className="relative flex-1 min-w-[100px] max-w-none md:max-w-[250px]">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-fg" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Поиск..."
          className="w-full pl-8 pr-3 py-1.5 text-sm bg-surface-alt/50 border border-border-strong rounded-lg text-foreground placeholder-muted outline-none focus:border-accent/40 transition-colors"
        />
      </div>

      {/* Enter folder */}
      {singleFolderSelected && (
        <button
          onClick={onEnterFolder}
          className="flex items-center gap-1.5 px-3 py-2 md:px-2.5 md:py-1.5 text-xs text-success hover:text-success/80 bg-success/10 border border-success/20 rounded-lg transition-colors cursor-pointer"
          title="Войти в папку"
        >
          <FolderOpen className="w-3.5 h-3.5" />
          <span>Войти</span>
        </button>
      )}

      {/* Download selected */}
      {selectedCount > 0 && (
        <button
          onClick={onDownloadSelected}
          className="flex items-center gap-1.5 px-3 py-2 md:px-2.5 md:py-1.5 text-xs text-accent-fg hover:text-accent-fg/80 bg-accent-muted border border-accent/20 rounded-lg transition-colors cursor-pointer"
          title="Скачать выбранные"
        >
          <Download className="w-3.5 h-3.5" />
          <span>{selectedCount}</span>
        </button>
      )}

      {/* Delete selected */}
      {selectedCount > 0 && (
        <button
          onClick={onDeleteSelected}
          className="flex items-center gap-1.5 px-3 py-2 md:px-2.5 md:py-1.5 text-xs text-danger hover:text-danger/80 bg-danger/10 border border-danger/20 rounded-lg transition-colors cursor-pointer"
          title="Удалить выбранные"
        >
          <Trash className="w-3.5 h-3.5" />
          <span>{selectedCount}</span>
        </button>
      )}
    </div>
  );
}

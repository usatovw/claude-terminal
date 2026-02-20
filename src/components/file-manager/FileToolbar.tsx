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
      <div className="relative flex-1 min-w-[140px] max-w-[250px]">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Поиск..."
          className="w-full pl-8 pr-3 py-1.5 text-sm bg-zinc-900/50 border border-zinc-800 rounded-lg text-zinc-300 placeholder-zinc-600 outline-none focus:border-violet-500/40 transition-colors"
        />
      </div>

      {/* Enter folder */}
      {singleFolderSelected && (
        <button
          onClick={onEnterFolder}
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 rounded-lg transition-colors cursor-pointer"
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
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-violet-400 hover:text-violet-300 bg-violet-500/10 border border-violet-500/20 rounded-lg transition-colors cursor-pointer"
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
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-red-400 hover:text-red-300 bg-red-500/10 border border-red-500/20 rounded-lg transition-colors cursor-pointer"
          title="Удалить выбранные"
        >
          <Trash className="w-3.5 h-3.5" />
          <span>{selectedCount}</span>
        </button>
      )}
    </div>
  );
}

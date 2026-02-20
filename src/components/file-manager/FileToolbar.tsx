"use client";

import { Search, SortAsc, SortDesc, Download, Trash, CheckSquare, Square } from "@/components/Icons";

export type SortField = "name" | "size" | "modifiedAt";
export type SortDirection = "asc" | "desc";

interface FileToolbarProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  sortBy: SortField;
  sortDir: SortDirection;
  onSortChange: (field: SortField) => void;
  selectedCount: number;
  totalCount: number;
  onSelectAll: () => void;
  onDownloadSelected: () => void;
  onDeleteSelected: () => void;
}

const SORT_LABELS: Record<SortField, string> = {
  name: "Имя",
  size: "Размер",
  modifiedAt: "Дата",
};

export default function FileToolbar({
  searchQuery,
  onSearchChange,
  sortBy,
  sortDir,
  onSortChange,
  selectedCount,
  totalCount,
  onSelectAll,
  onDownloadSelected,
  onDeleteSelected,
}: FileToolbarProps) {
  const nextSort = (): void => {
    const fields: SortField[] = ["name", "size", "modifiedAt"];
    const currentIdx = fields.indexOf(sortBy);
    // If clicking the same field, toggle direction; otherwise go to next field
    if (sortDir === "asc") {
      onSortChange(sortBy); // toggles to desc
    } else {
      const nextField = fields[(currentIdx + 1) % fields.length];
      onSortChange(nextField);
    }
  };

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

      {/* Sort */}
      <button
        onClick={nextSort}
        className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 bg-zinc-900/50 border border-zinc-800 rounded-lg transition-colors cursor-pointer"
        title="Сортировка"
      >
        {sortDir === "asc" ? (
          <SortAsc className="w-3.5 h-3.5" />
        ) : (
          <SortDesc className="w-3.5 h-3.5" />
        )}
        <span>{SORT_LABELS[sortBy]}</span>
      </button>

      {/* Select all */}
      <button
        onClick={onSelectAll}
        className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 bg-zinc-900/50 border border-zinc-800 rounded-lg transition-colors cursor-pointer"
        title={selectedCount === totalCount && totalCount > 0 ? "Снять выделение" : "Выделить всё"}
      >
        {selectedCount === totalCount && totalCount > 0 ? (
          <CheckSquare className="w-3.5 h-3.5" />
        ) : (
          <Square className="w-3.5 h-3.5" />
        )}
      </button>

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

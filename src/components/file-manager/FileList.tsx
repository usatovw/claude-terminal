"use client";

import { AnimatePresence } from "motion/react";
import FileItem, { FileEntry } from "./FileItem";
import FileTableHeader from "./FileTableHeader";
import { SortField, SortDirection } from "./FileToolbar";
import { Search, FolderIcon } from "@/components/Icons";

interface FileListProps {
  entries: FileEntry[];
  selectedPaths: Set<string>;
  renamingEntry: string | null;
  renameName: string;
  onSelect: (name: string, e: React.MouseEvent) => void;
  onCheckboxChange: (name: string) => void;
  onNavigate: (name: string) => void;
  onDownload: (name: string) => void;
  onRenameStart: (name: string) => void;
  onRenameChange: (name: string) => void;
  onRenameSubmit: () => void;
  onRenameCancel: () => void;
  onDelete: (name: string) => void;
  loading: boolean;
  sortBy: SortField;
  sortDir: SortDirection;
  onSortChange: (field: SortField) => void;
  allSelected: boolean;
  someSelected: boolean;
  onSelectAll: () => void;
  columnWidths: string;
  onColumnResize: (widths: string) => void;
  searchQuery: string;
  isRootPath: boolean;
}

export default function FileList({
  entries,
  selectedPaths,
  renamingEntry,
  renameName,
  onSelect,
  onCheckboxChange,
  onNavigate,
  onDownload,
  onRenameStart,
  onRenameChange,
  onRenameSubmit,
  onRenameCancel,
  onDelete,
  loading,
  sortBy,
  sortDir,
  onSortChange,
  allSelected,
  someSelected,
  onSelectAll,
  columnWidths,
  onColumnResize,
  searchQuery,
  isRootPath,
}: FileListProps) {
  const renderEmptyState = () => {
    if (searchQuery) {
      return (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <Search className="w-8 h-8 text-zinc-700" />
          <span className="text-zinc-500 text-sm">Ничего не нашлось</span>
        </div>
      );
    }
    if (isRootPath) {
      return (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <FolderIcon className="w-8 h-8 text-zinc-700" />
          <span className="text-zinc-500 text-sm">Файлы сессии будут доступны здесь</span>
        </div>
      );
    }
    return (
      <div className="flex items-center justify-center py-16">
        <span className="text-zinc-500 text-sm">Папка пуста</span>
      </div>
    );
  };

  return (
    <div>
      <FileTableHeader
        sortBy={sortBy}
        sortDir={sortDir}
        onSortChange={onSortChange}
        allSelected={allSelected}
        someSelected={someSelected}
        onSelectAll={onSelectAll}
        columnWidths={columnWidths}
        onColumnResize={onColumnResize}
      />

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin h-6 w-6 border-2 border-violet-500 border-t-transparent rounded-full" />
        </div>
      ) : entries.length === 0 ? (
        renderEmptyState()
      ) : (
        <div className="divide-y divide-zinc-800/30">
          <AnimatePresence mode="popLayout">
            {entries.map((entry) => (
              <FileItem
                key={entry.relativePath || entry.name}
                entry={entry}
                isSelected={selectedPaths.has(entry.relativePath || entry.name)}
                isChecked={selectedPaths.has(entry.relativePath || entry.name)}
                isRenaming={renamingEntry === entry.name}
                renameName={renameName}
                gridTemplateColumns={columnWidths}
                onSelect={(e) => onSelect(entry.relativePath || entry.name, e)}
                onCheckboxChange={() => onCheckboxChange(entry.relativePath || entry.name)}
                onNavigate={() => onNavigate(entry.relativePath || entry.name)}
                onDownload={() => onDownload(entry.relativePath || entry.name)}
                onRenameStart={() => onRenameStart(entry.name)}
                onRenameChange={onRenameChange}
                onRenameSubmit={onRenameSubmit}
                onRenameCancel={onRenameCancel}
                onDelete={() => onDelete(entry.name)}
              />
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

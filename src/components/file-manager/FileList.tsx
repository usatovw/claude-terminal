"use client";

import { AnimatePresence } from "motion/react";
import FileItem, { FileEntry } from "./FileItem";
import FileTableHeader from "./FileTableHeader";
import { SortField, SortDirection } from "./FileToolbar";
import { TextGenerateEffect } from "@/components/ui/text-generate-effect";

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
}: FileListProps) {
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
        <div className="flex items-center justify-center py-16">
          <TextGenerateEffect
            words="Папка пуста"
            className="text-zinc-500 text-sm"
          />
        </div>
      ) : (
        <div className="space-y-0.5 pt-0.5">
          <AnimatePresence mode="popLayout">
            {entries.map((entry) => (
              <FileItem
                key={entry.name}
                entry={entry}
                isSelected={selectedPaths.has(entry.name)}
                isChecked={selectedPaths.has(entry.name)}
                isRenaming={renamingEntry === entry.name}
                renameName={renameName}
                gridTemplateColumns={columnWidths}
                onSelect={(e) => onSelect(entry.name, e)}
                onCheckboxChange={() => onCheckboxChange(entry.name)}
                onNavigate={() => onNavigate(entry.name)}
                onDownload={() => onDownload(entry.name)}
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

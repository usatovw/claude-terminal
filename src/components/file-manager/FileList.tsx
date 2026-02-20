"use client";

import { AnimatePresence } from "motion/react";
import FileItem, { FileEntry } from "./FileItem";
import { TextGenerateEffect } from "@/components/ui/text-generate-effect";

interface FileListProps {
  entries: FileEntry[];
  selectedPaths: Set<string>;
  renamingEntry: string | null;
  renameName: string;
  onSelect: (name: string, e: React.MouseEvent) => void;
  onNavigate: (name: string) => void;
  onDownload: (name: string) => void;
  onRenameStart: (name: string) => void;
  onRenameChange: (name: string) => void;
  onRenameSubmit: () => void;
  onRenameCancel: () => void;
  onDelete: (name: string) => void;
  loading: boolean;
}

export default function FileList({
  entries,
  selectedPaths,
  renamingEntry,
  renameName,
  onSelect,
  onNavigate,
  onDownload,
  onRenameStart,
  onRenameChange,
  onRenameSubmit,
  onRenameCancel,
  onDelete,
  loading,
}: FileListProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="animate-spin h-6 w-6 border-2 border-violet-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="flex items-center justify-center py-16">
        <TextGenerateEffect
          words="Папка пуста"
          className="text-zinc-500 text-sm"
        />
      </div>
    );
  }

  return (
    <div className="space-y-0.5">
      <AnimatePresence mode="popLayout">
        {entries.map((entry) => (
          <FileItem
            key={entry.name}
            entry={entry}
            isSelected={selectedPaths.has(entry.name)}
            isRenaming={renamingEntry === entry.name}
            renameName={renameName}
            onSelect={(e) => onSelect(entry.name, e)}
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
  );
}

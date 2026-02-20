"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import Breadcrumbs from "@/components/file-manager/Breadcrumbs";
import FileToolbar, { SortField, SortDirection } from "@/components/file-manager/FileToolbar";
import FileList from "@/components/file-manager/FileList";
import DeleteConfirmModal from "@/components/file-manager/DeleteConfirmModal";
import { FileEntry } from "@/components/file-manager/FileItem";
import path from "path";

interface FileManagerProps {
  sessionId: string;
}

export default function FileManager({ sessionId }: FileManagerProps) {
  const [currentPath, setCurrentPath] = useState(".");
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<SortField>("name");
  const [sortDir, setSortDir] = useState<SortDirection>("asc");
  const [searchQuery, setSearchQuery] = useState("");
  const [renamingEntry, setRenamingEntry] = useState<string | null>(null);
  const [renameName, setRenameName] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<string[] | null>(null);

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/sessions/${sessionId}/files?path=${encodeURIComponent(currentPath)}`
      );
      if (res.ok) {
        const data = await res.json();
        setEntries(data.entries);
      } else {
        setEntries([]);
      }
    } catch {
      setEntries([]);
    }
    setLoading(false);
  }, [sessionId, currentPath]);

  useEffect(() => {
    fetchEntries();
    setSelectedPaths(new Set());
    setRenamingEntry(null);
    setSearchQuery("");
  }, [fetchEntries]);

  // Sort and filter entries
  const processedEntries = useMemo(() => {
    let filtered = entries;

    // Search filter
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = entries.filter((e) => e.name.toLowerCase().includes(q));
    }

    // Separate directories and files
    const dirs = filtered.filter((e) => e.type === "directory");
    const files = filtered.filter((e) => e.type === "file");

    const compare = (a: FileEntry, b: FileEntry): number => {
      let result: number;
      switch (sortBy) {
        case "name":
          result = a.name.localeCompare(b.name);
          break;
        case "size":
          result = a.size - b.size;
          break;
        case "modifiedAt":
          result = new Date(a.modifiedAt).getTime() - new Date(b.modifiedAt).getTime();
          break;
        default:
          result = 0;
      }
      return sortDir === "asc" ? result : -result;
    };

    dirs.sort(compare);
    files.sort(compare);

    return [...dirs, ...files];
  }, [entries, searchQuery, sortBy, sortDir]);

  const handleNavigate = useCallback(
    (name: string) => {
      if (name === ".") {
        setCurrentPath(".");
      } else if (currentPath === ".") {
        setCurrentPath(name);
      } else {
        setCurrentPath(currentPath + "/" + name);
      }
    },
    [currentPath]
  );

  const handleBreadcrumbNavigate = useCallback((newPath: string) => {
    setCurrentPath(newPath);
  }, []);

  const handleSelect = useCallback(
    (name: string, e: React.MouseEvent) => {
      setSelectedPaths((prev) => {
        const next = new Set(prev);
        if (e.ctrlKey || e.metaKey) {
          // Toggle
          if (next.has(name)) next.delete(name);
          else next.add(name);
        } else {
          // Single select
          if (next.has(name) && next.size === 1) {
            next.clear();
          } else {
            next.clear();
            next.add(name);
          }
        }
        return next;
      });
    },
    []
  );

  const handleSelectAll = useCallback(() => {
    if (selectedPaths.size === processedEntries.length && processedEntries.length > 0) {
      setSelectedPaths(new Set());
    } else {
      setSelectedPaths(new Set(processedEntries.map((e) => e.name)));
    }
  }, [processedEntries, selectedPaths.size]);

  const handleSortChange = useCallback(
    (field: SortField) => {
      if (field === sortBy) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      } else {
        setSortBy(field);
        setSortDir("asc");
      }
    },
    [sortBy]
  );

  // Build the full relative path for a file
  const fullPath = (name: string) =>
    currentPath === "." ? name : currentPath + "/" + name;

  // Download single file
  const handleDownload = useCallback(
    (name: string) => {
      const p = fullPath(name);
      const url = `/api/sessions/${sessionId}/files/download?path=${encodeURIComponent(p)}`;
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    },
    [sessionId, currentPath]
  );

  // Download selected as zip
  const handleDownloadSelected = useCallback(async () => {
    const paths = [...selectedPaths].map((name) => fullPath(name));
    if (paths.length === 1) {
      // Check if it's a file — just download directly
      const entry = entries.find((e) => e.name === [...selectedPaths][0]);
      if (entry && entry.type === "file") {
        handleDownload([...selectedPaths][0]);
        return;
      }
    }
    try {
      const res = await fetch(`/api/sessions/${sessionId}/files/download-zip`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paths }),
      });
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "files.zip";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    } catch {
      // ignore
    }
  }, [selectedPaths, sessionId, currentPath, entries, handleDownload]);

  // Rename
  const handleRenameStart = useCallback((name: string) => {
    setRenamingEntry(name);
    setRenameName(name);
  }, []);

  const handleRenameSubmit = useCallback(async () => {
    if (!renamingEntry || !renameName.trim() || renameName === renamingEntry) {
      setRenamingEntry(null);
      return;
    }
    try {
      const oldPath = fullPath(renamingEntry);
      await fetch(`/api/sessions/${sessionId}/files/rename`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ oldPath, newName: renameName.trim() }),
      });
      fetchEntries();
    } catch {
      // ignore
    }
    setRenamingEntry(null);
  }, [renamingEntry, renameName, sessionId, currentPath, fetchEntries]);

  const handleRenameCancel = useCallback(() => {
    setRenamingEntry(null);
  }, []);

  // Delete
  const handleDeleteSingle = useCallback((name: string) => {
    setDeleteConfirm([name]);
  }, []);

  const handleDeleteSelected = useCallback(() => {
    setDeleteConfirm([...selectedPaths]);
  }, [selectedPaths]);

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteConfirm) return;
    const paths = deleteConfirm.map((name) => fullPath(name));
    try {
      await fetch(`/api/sessions/${sessionId}/files/delete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paths }),
      });
      setSelectedPaths((prev) => {
        const next = new Set(prev);
        for (const name of deleteConfirm) next.delete(name);
        return next;
      });
      fetchEntries();
    } catch {
      // ignore
    }
    setDeleteConfirm(null);
  }, [deleteConfirm, sessionId, currentPath, fetchEntries]);

  return (
    <div className="flex flex-col h-full bg-[#0a0a0a] rounded-xl overflow-hidden">
      {/* Toolbar */}
      <div className="border-b border-zinc-800/50 px-4 py-3 space-y-3">
        <Breadcrumbs currentPath={currentPath} onNavigate={handleBreadcrumbNavigate} />
        <FileToolbar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          sortBy={sortBy}
          sortDir={sortDir}
          onSortChange={handleSortChange}
          selectedCount={selectedPaths.size}
          totalCount={processedEntries.length}
          onSelectAll={handleSelectAll}
          onDownloadSelected={handleDownloadSelected}
          onDeleteSelected={handleDeleteSelected}
        />
      </div>

      {/* File list */}
      <div className="flex-1 overflow-y-auto px-2 py-2">
        <FileList
          entries={processedEntries}
          selectedPaths={selectedPaths}
          renamingEntry={renamingEntry}
          renameName={renameName}
          onSelect={handleSelect}
          onNavigate={handleNavigate}
          onDownload={handleDownload}
          onRenameStart={handleRenameStart}
          onRenameChange={setRenameName}
          onRenameSubmit={handleRenameSubmit}
          onRenameCancel={handleRenameCancel}
          onDelete={handleDeleteSingle}
          loading={loading}
        />
      </div>

      {/* Delete modal */}
      <DeleteConfirmModal
        paths={deleteConfirm}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteConfirm(null)}
      />
    </div>
  );
}

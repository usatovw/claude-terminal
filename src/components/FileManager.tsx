"use client";

import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import Breadcrumbs from "@/components/file-manager/Breadcrumbs";
import FileToolbar, { SortField, SortDirection } from "@/components/file-manager/FileToolbar";
import FileList from "@/components/file-manager/FileList";
import DeleteConfirmModal from "@/components/file-manager/DeleteConfirmModal";
import { FileEntry } from "@/components/file-manager/FileItem";
import { useIsMobile } from "@/lib/useIsMobile";

const MOBILE_COLUMNS = "32px 28px 1fr 80px";

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
  const [columnWidths, setColumnWidths] = useState("32px 28px 1fr 100px 140px 80px");
  const isMobile = useIsMobile();
  const effectiveColumns = isMobile ? MOBILE_COLUMNS : columnWidths;
  const [searchResults, setSearchResults] = useState<FileEntry[] | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    setSearchResults(null);
  }, [fetchEntries]);

  // Debounced recursive search
  useEffect(() => {
    if (searchTimerRef.current) {
      clearTimeout(searchTimerRef.current);
    }

    if (!searchQuery.trim()) {
      setSearchResults(null);
      setSearchLoading(false);
      return;
    }

    setSearchLoading(true);
    searchTimerRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/sessions/${sessionId}/files?search=${encodeURIComponent(searchQuery.trim())}`
        );
        if (res.ok) {
          const data = await res.json();
          setSearchResults(data.entries);
        } else {
          setSearchResults([]);
        }
      } catch {
        setSearchResults([]);
      }
      setSearchLoading(false);
    }, 300);

    return () => {
      if (searchTimerRef.current) {
        clearTimeout(searchTimerRef.current);
      }
    };
  }, [searchQuery, sessionId]);

  // Sort and filter entries
  const processedEntries = useMemo(() => {
    const source = searchResults ?? entries;

    const dirs = source.filter((e) => e.type === "directory");
    const files = source.filter((e) => e.type === "file");

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
  }, [entries, searchResults, sortBy, sortDir]);

  const singleFolderSelected = useMemo(() => {
    if (selectedPaths.size !== 1) return false;
    const key = [...selectedPaths][0];
    const entry = processedEntries.find((e) => (e.relativePath || e.name) === key);
    return entry?.type === "directory" || false;
  }, [selectedPaths, processedEntries]);

  const allSelected = processedEntries.length > 0 && selectedPaths.size === processedEntries.length;
  const someSelected = selectedPaths.size > 0 && !allSelected;

  const handleNavigate = useCallback(
    (nameOrPath: string) => {
      // If in search mode, navigate to parent folder of the result
      if (searchResults) {
        const entry = searchResults.find((e) => (e.relativePath || e.name) === nameOrPath);
        if (entry?.type === "directory" && entry.relativePath) {
          setSearchQuery("");
          setSearchResults(null);
          setCurrentPath(entry.relativePath);
          return;
        }
        if (entry?.relativePath) {
          // Navigate to parent directory of the file
          const parentDir = entry.relativePath.split("/").slice(0, -1).join("/");
          setSearchQuery("");
          setSearchResults(null);
          setCurrentPath(parentDir || ".");
          return;
        }
      }

      if (nameOrPath === ".") {
        setCurrentPath(".");
      } else if (currentPath === ".") {
        setCurrentPath(nameOrPath);
      } else {
        setCurrentPath(currentPath + "/" + nameOrPath);
      }
    },
    [currentPath, searchResults]
  );

  const handleBreadcrumbNavigate = useCallback((newPath: string) => {
    setCurrentPath(newPath);
  }, []);

  const handleSelect = useCallback(
    (key: string, e: React.MouseEvent) => {
      setSelectedPaths((prev) => {
        const next = new Set(prev);
        if (e.ctrlKey || e.metaKey) {
          if (next.has(key)) next.delete(key);
          else next.add(key);
        } else {
          if (next.has(key) && next.size === 1) {
            next.clear();
          } else {
            next.clear();
            next.add(key);
          }
        }
        return next;
      });
    },
    []
  );

  const handleCheckboxChange = useCallback((key: string) => {
    setSelectedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    if (selectedPaths.size === processedEntries.length && processedEntries.length > 0) {
      setSelectedPaths(new Set());
    } else {
      setSelectedPaths(new Set(processedEntries.map((e) => e.relativePath || e.name)));
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

  const handleEnterFolder = useCallback(() => {
    if (selectedPaths.size !== 1) return;
    const key = [...selectedPaths][0];
    handleNavigate(key);
  }, [selectedPaths, handleNavigate]);

  const fullPath = (name: string) =>
    currentPath === "." ? name : currentPath + "/" + name;

  const handleDownload = useCallback(
    (nameOrPath: string) => {
      // In search mode, relativePath is already relative to project root
      const p = searchResults
        ? nameOrPath
        : fullPath(nameOrPath);
      const fileName = nameOrPath.split("/").pop() || nameOrPath;
      const url = `/api/sessions/${sessionId}/files/download?path=${encodeURIComponent(p)}`;
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    },
    [sessionId, currentPath, searchResults]
  );

  const handleDownloadSelected = useCallback(async () => {
    const keys = [...selectedPaths];
    const paths = keys.map((key) => searchResults ? key : fullPath(key));
    if (paths.length === 1) {
      const entry = processedEntries.find((e) => (e.relativePath || e.name) === keys[0]);
      if (entry && entry.type === "file") {
        handleDownload(keys[0]);
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
  }, [selectedPaths, sessionId, currentPath, processedEntries, handleDownload, searchResults]);

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
    <div className="flex flex-col w-full h-full bg-[#0a0a0a] rounded-xl overflow-hidden">
      {/* Toolbar */}
      <div className="border-b border-zinc-800/50 px-4 py-3 space-y-3">
        <Breadcrumbs currentPath={currentPath} onNavigate={handleBreadcrumbNavigate} />
        <FileToolbar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          selectedCount={selectedPaths.size}
          onDownloadSelected={handleDownloadSelected}
          onDeleteSelected={handleDeleteSelected}
          singleFolderSelected={singleFolderSelected}
          onEnterFolder={handleEnterFolder}
        />
      </div>

      {/* File list */}
      <div className="flex-1 overflow-y-auto">
        <FileList
          entries={processedEntries}
          selectedPaths={selectedPaths}
          renamingEntry={renamingEntry}
          renameName={renameName}
          onSelect={handleSelect}
          onCheckboxChange={handleCheckboxChange}
          onNavigate={handleNavigate}
          onDownload={handleDownload}
          onRenameStart={handleRenameStart}
          onRenameChange={setRenameName}
          onRenameSubmit={handleRenameSubmit}
          onRenameCancel={handleRenameCancel}
          onDelete={handleDeleteSingle}
          loading={loading || searchLoading}
          sortBy={sortBy}
          sortDir={sortDir}
          onSortChange={handleSortChange}
          allSelected={allSelected}
          someSelected={someSelected}
          onSelectAll={handleSelectAll}
          columnWidths={effectiveColumns}
          onColumnResize={setColumnWidths}
          searchQuery={searchQuery}
          isRootPath={currentPath === "."}
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

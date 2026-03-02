"use client";

import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import Breadcrumbs from "@/components/file-manager/Breadcrumbs";
import FileToolbar, { SortField, SortDirection } from "@/components/file-manager/FileToolbar";
import FileList from "@/components/file-manager/FileList";
import DeleteConfirmModal from "@/components/file-manager/DeleteConfirmModal";
import EditorWorkspace from "@/components/file-manager/EditorWorkspace";
import NewFileModal from "@/components/file-manager/NewFileModal";
import UnsavedChangesModal from "@/components/file-manager/UnsavedChangesModal";
import { FileEntry } from "@/components/file-manager/FileItem";
import { Upload } from "@/components/Icons";
import { useIsMobile } from "@/lib/useIsMobile";
import { useEditorTabs } from "@/lib/useEditorTabs";
import { useEditor } from "@/lib/EditorContext";
import { useUser } from "@/lib/UserContext";
import { isTextFile, isImageFile } from "@/lib/editor-utils";

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB
const MAX_FILES = 100;
const DANGEROUS_EXTENSIONS = new Set([
  ".exe", ".bat", ".cmd", ".sh", ".ps1", ".msi", ".dll", ".so",
]);

interface UploadItem {
  file: File;
  relativePath: string;
}

/** Recursively read all files from a DataTransfer (supports folders via webkitGetAsEntry) */
async function readDroppedItems(dataTransfer: DataTransfer): Promise<UploadItem[]> {
  const items: UploadItem[] = [];

  // Try webkitGetAsEntry for folder support
  const entries: FileSystemEntry[] = [];
  for (let i = 0; i < dataTransfer.items.length; i++) {
    const entry = dataTransfer.items[i].webkitGetAsEntry?.();
    if (entry) entries.push(entry);
  }

  if (entries.length > 0) {
    async function readEntry(entry: FileSystemEntry, basePath: string) {
      if (entry.isFile) {
        const file = await new Promise<File>((resolve, reject) => {
          (entry as FileSystemFileEntry).file(resolve, reject);
        });
        items.push({ file, relativePath: basePath + entry.name });
      } else if (entry.isDirectory) {
        const reader = (entry as FileSystemDirectoryEntry).createReader();
        // readEntries returns batches — must call repeatedly until empty
        let batch: FileSystemEntry[];
        do {
          batch = await new Promise<FileSystemEntry[]>((resolve, reject) => {
            reader.readEntries(resolve, reject);
          });
          for (const child of batch) {
            await readEntry(child, basePath + entry.name + "/");
          }
        } while (batch.length > 0);
      }
    }

    for (const entry of entries) {
      await readEntry(entry, "");
    }
    return items;
  }

  // Fallback: plain files (no folder API support)
  for (let i = 0; i < dataTransfer.files.length; i++) {
    const file = dataTransfer.files[i];
    items.push({ file, relativePath: file.name });
  }
  return items;
}

const MOBILE_COLUMNS = "32px 28px 1fr 80px";

interface FileManagerProps {
  sessionId: string;
  initialFile?: string | null;
  visible?: boolean;
}

function FileManagerInner({ sessionId, initialFile, visible = true }: FileManagerProps) {
  const router = useRouter();
  const { setHasUnsavedChanges, setCloseHandler } = useEditor();
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
  const [newFileModal, setNewFileModal] = useState(false);

  // Upload state
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const dragCounterRef = useRef(0);
  const [isDragging, setIsDragging] = useState(false);
  const { isGuest } = useUser();

  // Editor tabs
  const {
    tabs, activeTabId, activeTab, showEditor, hasDirtyTabs,
    openTab, closeTab, setActiveTab,
    markDirty, markClean, updateMtime,
    closeOthers, closeAll, hideEditor,
  } = useEditorTabs(sessionId);

  const editorMode = showEditor;

  // Sync unsaved state to EditorContext
  useEffect(() => {
    setHasUnsavedChanges(hasDirtyTabs);
  }, [hasDirtyTabs, setHasUnsavedChanges]);

  // Open initial file if provided
  useEffect(() => {
    if (initialFile) {
      const name = initialFile.split("/").pop() || initialFile;
      openTab(initialFile, name);
      router.replace("/dashboard", { scroll: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Clear ?file= param from URL after consuming it
  useEffect(() => {
    if (initialFile) {
      router.replace("/dashboard", { scroll: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchEntries = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
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
    if (!silent) setLoading(false);
  }, [sessionId, currentPath]);

  // Fetch entries when path or session changes
  const initialLoadDone = useRef(false);
  useEffect(() => {
    fetchEntries(initialLoadDone.current);
    initialLoadDone.current = true;
  }, [fetchEntries]);

  // Full reset when session changes
  const prevSessionIdRef = useRef(sessionId);
  useEffect(() => {
    if (prevSessionIdRef.current !== sessionId) {
      prevSessionIdRef.current = sessionId;
      setCurrentPath(".");
      setSelectedPaths(new Set());
      setRenamingEntry(null);
      setSearchQuery("");
      setSearchResults(null);
      initialLoadDone.current = false;
    }
  }, [sessionId]);

  // Refresh on visibility change + poll while visible (suspend when editor open)
  const prevVisibleRef = useRef(visible);
  useEffect(() => {
    if (visible && !prevVisibleRef.current) {
      fetchEntries(true);
    }
    prevVisibleRef.current = visible;

    // Suspend polling when editor is open
    if (!visible || editorMode) return;
    const interval = setInterval(() => fetchEntries(true), 3000);
    return () => clearInterval(interval);
  }, [visible, fetchEntries, editorMode]);

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
      setSelectedPaths(new Set());
      setRenamingEntry(null);

      if (searchResults) {
        const entry = searchResults.find((e) => (e.relativePath || e.name) === nameOrPath);
        if (entry?.type === "directory" && entry.relativePath) {
          setSearchQuery("");
          setSearchResults(null);
          setCurrentPath(entry.relativePath);
          return;
        }
        if (entry?.relativePath) {
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
    setSelectedPaths(new Set());
    setRenamingEntry(null);
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

  // Open file in editor
  const handleOpenFile = useCallback(
    (nameOrPath: string) => {
      const p = searchResults ? nameOrPath : fullPath(nameOrPath);
      const name = nameOrPath.split("/").pop() || nameOrPath;
      setSelectedPaths(new Set());
      openTab(p, name);
    },
    [currentPath, searchResults, openTab]
  );

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

  // Editor back handler — hide editor but keep tabs alive
  const handleEditorBack = useCallback(() => {
    hideEditor();
  }, [hideEditor]);

  // Handle file creation
  const handleFileCreated = useCallback((relativePath: string, name: string, type: "file" | "folder") => {
    fetchEntries();
    if (type === "file") {
      openTab(relativePath, name);
    }
  }, [fetchEntries, openTab]);

  // Core upload handler (supports relative paths for folder structure)
  const handleUploadItems = useCallback(async (items: UploadItem[]) => {
    // Client-side validation
    if (items.length > MAX_FILES) {
      setUploadError(`Максимум ${MAX_FILES} файлов за раз`);
      setTimeout(() => setUploadError(null), 5000);
      return;
    }

    const errors: string[] = [];
    const validItems: UploadItem[] = [];

    for (const item of items) {
      const ext = item.file.name.includes(".")
        ? "." + item.file.name.split(".").pop()!.toLowerCase()
        : "";
      if (DANGEROUS_EXTENSIONS.has(ext)) {
        errors.push(`${item.relativePath}: расширение ${ext} запрещено`);
        continue;
      }
      if (item.file.size > MAX_FILE_SIZE) {
        errors.push(`${item.relativePath}: превышает 50 МБ`);
        continue;
      }
      validItems.push(item);
    }

    if (validItems.length === 0) {
      setUploadError(errors.join("; "));
      setTimeout(() => setUploadError(null), 5000);
      return;
    }

    setUploading(true);
    setUploadError(null);

    try {
      const formData = new FormData();
      formData.append("directory", currentPath);
      for (const item of validItems) {
        formData.append("file", item.file);
        formData.append("relativePath", item.relativePath);
      }

      const res = await fetch(`/api/sessions/${sessionId}/files/upload`, {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok && !data.errors) {
        setUploadError(data.error || "Ошибка загрузки");
        setTimeout(() => setUploadError(null), 5000);
      } else {
        const serverErrors = data.errors as { name: string; error: string }[];
        const allErrors = [
          ...errors,
          ...serverErrors.map((e: { name: string; error: string }) => `${e.name}: ${e.error}`),
        ];
        if (allErrors.length > 0) {
          setUploadError(allErrors.join("; "));
          setTimeout(() => setUploadError(null), 5000);
        }
        fetchEntries();
      }
    } catch {
      setUploadError("Ошибка сети");
      setTimeout(() => setUploadError(null), 5000);
    }
    setUploading(false);
  }, [currentPath, sessionId, fetchEntries]);

  // Wrapper for simple FileList uploads (toolbar button)
  const handleUpload = useCallback(async (files: FileList | File[]) => {
    const items: UploadItem[] = Array.from(files).map((file) => ({
      file,
      relativePath: file.name,
    }));
    handleUploadItems(items);
  }, [handleUploadItems]);

  // Drag & Drop handlers
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (isGuest) return;
    dragCounterRef.current++;
    if (dragCounterRef.current === 1) {
      setIsDragging(true);
    }
  }, [isGuest]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    dragCounterRef.current--;
    if (dragCounterRef.current === 0) {
      setIsDragging(false);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    dragCounterRef.current = 0;
    setIsDragging(false);
    if (isGuest) return;
    const items = await readDroppedItems(e.dataTransfer);
    if (items.length > 0) {
      handleUploadItems(items);
    }
  }, [isGuest, handleUploadItems]);

  // Promise-based close handler for external guards (view switch, session switch)
  const pendingCloseRef = useRef<{ resolve: (v: boolean) => void } | null>(null);
  const [showExternalUnsavedModal, setShowExternalUnsavedModal] = useState(false);

  useEffect(() => {
    setCloseHandler(async () => {
      if (!hasDirtyTabs) return true;
      return new Promise<boolean>((resolve) => {
        pendingCloseRef.current = { resolve };
        setShowExternalUnsavedModal(true);
      });
    });
    return () => setCloseHandler(null);
  }, [hasDirtyTabs, setCloseHandler]);

  const handleExternalUnsavedSave = useCallback(async () => {
    // Cannot save from outside EditorWorkspace — treat as discard
    setShowExternalUnsavedModal(false);
    pendingCloseRef.current?.resolve(true);
    pendingCloseRef.current = null;
  }, []);

  const handleExternalUnsavedDiscard = useCallback(() => {
    setShowExternalUnsavedModal(false);
    pendingCloseRef.current?.resolve(true);
    pendingCloseRef.current = null;
  }, []);

  const handleExternalUnsavedCancel = useCallback(() => {
    setShowExternalUnsavedModal(false);
    pendingCloseRef.current?.resolve(false);
    pendingCloseRef.current = null;
  }, []);

  // If editor mode with tabs open, show EditorWorkspace
  if (editorMode) {
    return (
      <>
        <EditorWorkspace
          sessionId={sessionId}
          tabs={tabs}
          activeTabId={activeTabId}
          activeTab={activeTab}
          onSelectTab={setActiveTab}
          onCloseTab={closeTab}
          onCloseOthers={closeOthers}
          onCloseAll={closeAll}
          onMarkDirty={markDirty}
          onMarkClean={markClean}
          onUpdateMtime={updateMtime}
          onOpenTab={openTab}
          onBack={handleEditorBack}
          onAddFile={hideEditor}
        />
        <UnsavedChangesModal
          open={showExternalUnsavedModal}
          onSave={handleExternalUnsavedSave}
          onDiscard={handleExternalUnsavedDiscard}
          onCancel={handleExternalUnsavedCancel}
        />
      </>
    );
  }

  return (
    <div
      className="flex flex-col w-full h-full bg-background rounded-xl overflow-hidden relative"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Toolbar */}
      <div className="border-b border-border px-4 py-3 space-y-3">
        <Breadcrumbs currentPath={currentPath} onNavigate={handleBreadcrumbNavigate} />
        <FileToolbar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          selectedCount={selectedPaths.size}
          onDownloadSelected={handleDownloadSelected}
          onDeleteSelected={handleDeleteSelected}
          singleFolderSelected={singleFolderSelected}
          onEnterFolder={handleEnterFolder}
          onNewItem={() => setNewFileModal(true)}
          onUpload={handleUpload}
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
          onOpenFile={handleOpenFile}
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

      {/* Upload progress / error */}
      {(uploading || uploadError) && (
        <div className="border-t border-border px-4 py-2 bg-surface-alt">
          {uploading && (
            <div className="flex items-center gap-2 text-sm text-muted-fg">
              <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <span>Загрузка файлов...</span>
            </div>
          )}
          {uploadError && (
            <div className="text-xs text-danger">{uploadError}</div>
          )}
        </div>
      )}

      {/* Drag & Drop overlay */}
      <AnimatePresence>
        {isDragging && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-40 flex items-center justify-center bg-accent/10 backdrop-blur-[2px]"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="flex flex-col items-center gap-3 p-8 rounded-2xl border-2 border-dashed border-accent bg-surface/80"
            >
              <Upload className="w-10 h-10 text-accent" />
              <span className="text-sm text-accent-fg font-medium">Перетащите файлы сюда</span>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete modal */}
      <DeleteConfirmModal
        paths={deleteConfirm}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteConfirm(null)}
      />

      {/* New file/folder modal */}
      <NewFileModal
        open={newFileModal}
        sessionId={sessionId}
        currentPath={currentPath}
        onClose={() => setNewFileModal(false)}
        onCreated={handleFileCreated}
      />
    </div>
  );
}

export default function FileManager(props: FileManagerProps) {
  return <FileManagerInner {...props} />;
}

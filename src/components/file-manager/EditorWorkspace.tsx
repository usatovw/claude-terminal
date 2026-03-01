"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import { ArrowLeft, Save, Eye, Code, Columns } from "@/components/Icons";
import TabBar from "./TabBar";
import PreviewPanel from "./PreviewPanel";
import UnsavedChangesModal from "./UnsavedChangesModal";
import { getPreviewType, isPreviewable } from "@/lib/editor-utils";
import type { EditorTab } from "@/lib/useEditorTabs";
import { useUser } from "@/lib/UserContext";
import { useIsMobile } from "@/lib/useIsMobile";

const CodeEditor = dynamic(() => import("./CodeEditor"), {
  ssr: false,
  loading: () => (
    <div className="flex-1 flex items-center justify-center bg-surface-alt">
      <div className="animate-spin h-6 w-6 border-2 border-accent border-t-transparent rounded-full" />
    </div>
  ),
});

interface EditorWorkspaceProps {
  sessionId: string;
  tabs: EditorTab[];
  activeTabId: string | null;
  activeTab: EditorTab | null;
  onSelectTab: (id: string) => void;
  onCloseTab: (id: string) => void;
  onCloseOthers: (id: string) => void;
  onCloseAll: () => void;
  onMarkDirty: (id: string) => void;
  onMarkClean: (id: string, mtime?: number) => void;
  onUpdateMtime: (id: string, mtime: number) => void;
  onOpenTab: (path: string, name: string, mtime?: number) => void;
  onBack: () => void;
  onAddFile?: () => void;
}

interface FileContent {
  content: string;
  mtime: number | null;
  error: string | null;
  loading: boolean;
}

export default function EditorWorkspace({
  sessionId,
  tabs,
  activeTabId,
  activeTab,
  onSelectTab,
  onCloseTab,
  onCloseOthers,
  onCloseAll,
  onMarkDirty,
  onMarkClean,
  onUpdateMtime,
  onOpenTab,
  onBack,
  onAddFile,
}: EditorWorkspaceProps) {
  const { isGuest } = useUser();
  const isMobile = useIsMobile();
  const [contents, setContents] = useState<Record<string, FileContent>>({});
  const [editorContents, setEditorContents] = useState<Record<string, string>>({});
  // Per-tab preview mode: "code" | "split" | "preview"
  const [previewModes, setPreviewModes] = useState<Record<string, "code" | "split" | "preview">>({});
  const [previewWidth, setPreviewWidth] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("editor-preview-width");
      if (saved) return Math.max(20, Math.min(80, Number(saved)));
    }
    return 50;
  });
  const [isDragging, setIsDragging] = useState(false);
  const splitContainerRef = useRef<HTMLDivElement>(null);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [unsavedModal, setUnsavedModal] = useState<{ tabId: string; action: "close" | "closeAll" | "closeOthers" | "back" } | null>(null);
  const [conflictTab, setConflictTab] = useState<string | null>(null);
  const tabsRef = useRef(tabs);
  tabsRef.current = tabs;
  const lastCheckRef = useRef(0);

  // Load file content when tab becomes active
  useEffect(() => {
    if (!activeTab) return;
    const tabId = activeTab.id;

    // Skip if already loaded
    if (contents[tabId] && !contents[tabId].error) return;

    setContents((prev) => ({
      ...prev,
      [tabId]: { content: "", mtime: null, error: null, loading: true },
    }));

    fetch(`/api/sessions/${sessionId}/files/read?path=${encodeURIComponent(activeTab.path)}`)
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          if (data.isBinary) {
            throw new Error("Бинарный файл — не может быть открыт в редакторе");
          }
          if (res.status === 413) {
            throw new Error(`Файл слишком большой (лимит: 2 МБ)`);
          }
          throw new Error(data.error || "Не удалось загрузить файл");
        }
        return res.json();
      })
      .then((data) => {
        setContents((prev) => ({
          ...prev,
          [tabId]: { content: data.content, mtime: data.mtime, error: null, loading: false },
        }));
        setEditorContents((prev) => ({ ...prev, [tabId]: data.content }));
        if (data.mtime) onUpdateMtime(tabId, data.mtime);
        // Ensure dirty flag is clean — file was just loaded from disk
        onMarkClean(tabId, data.mtime ?? undefined);
      })
      .catch((e) => {
        setContents((prev) => ({
          ...prev,
          [tabId]: { content: "", mtime: null, error: e.message, loading: false },
        }));
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab?.id, sessionId]);

  // Check for external changes — uses ref to avoid stale closure
  const checkExternalChanges = useCallback(async (tabId: string) => {
    if (savingRef.current) return;

    // Debounce: skip if checked within last 2 seconds
    const now = Date.now();
    if (now - lastCheckRef.current < 2000) return;
    lastCheckRef.current = now;

    const tab = tabsRef.current.find((t) => t.id === tabId);
    if (!tab || !tab.mtime) return;

    try {
      const res = await fetch(`/api/sessions/${sessionId}/files/read?path=${encodeURIComponent(tab.path)}`);
      if (!res.ok) return;
      const data = await res.json();
      if (data.mtime && Math.abs(data.mtime - tab.mtime) > 1) {
        setConflictTab(tabId);
        setContents((prev) => ({
          ...prev,
          [`${tabId}__conflict`]: { content: data.content, mtime: data.mtime, error: null, loading: false },
        }));
      }
    } catch {
      // Ignore network errors
    }
  }, [sessionId]);

  // Check external changes on tab switch
  const prevActiveRef = useRef(activeTabId);
  useEffect(() => {
    if (activeTabId && activeTabId !== prevActiveRef.current) {
      checkExternalChanges(activeTabId);
    }
    prevActiveRef.current = activeTabId;
  }, [activeTabId, checkExternalChanges]);

  // Check external changes on window focus
  useEffect(() => {
    const onFocus = () => {
      if (activeTabId) checkExternalChanges(activeTabId);
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [activeTabId, checkExternalChanges]);

  // Periodic polling for active tab (every 10 seconds)
  useEffect(() => {
    if (!activeTabId) return;
    const interval = setInterval(() => checkExternalChanges(activeTabId), 10000);
    return () => clearInterval(interval);
  }, [activeTabId, checkExternalChanges]);

  const handleChange = useCallback((tabId: string, newContent: string) => {
    setEditorContents((prev) => ({ ...prev, [tabId]: newContent }));
    const original = contents[tabId]?.content;
    if (original !== undefined && newContent !== original) {
      onMarkDirty(tabId);
    }
  }, [contents, onMarkDirty]);

  const handleSave = useCallback(async (tabId?: string) => {
    const id = tabId || activeTabId;
    if (!id || isGuest) return;

    const tab = tabs.find((t) => t.id === id);
    if (!tab) return;

    const content = editorContents[id];
    if (content === undefined) return;

    setSaving(true);
    savingRef.current = true;
    try {
      const res = await fetch(`/api/sessions/${sessionId}/files/write`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          path: tab.path,
          content,
          expectedMtime: tab.mtime,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        if (data.conflict) {
          setConflictTab(id);
          return;
        }
        throw new Error(data.error || "Ошибка сохранения");
      }

      const data = await res.json();
      onMarkClean(id, data.mtime);
      setContents((prev) => ({
        ...prev,
        [id]: { ...prev[id], content, mtime: data.mtime, error: null, loading: false },
      }));
    } catch {
      // Error handled via UI
    } finally {
      setSaving(false);
      savingRef.current = false;
    }
  }, [activeTabId, tabs, editorContents, sessionId, isGuest, onMarkClean]);

  // Handle tab close with unsaved check
  const handleTabClose = useCallback((tabId: string) => {
    const tab = tabs.find((t) => t.id === tabId);
    if (tab?.dirty) {
      setUnsavedModal({ tabId, action: "close" });
    } else {
      onCloseTab(tabId);
      // Cleanup content cache
      setContents((prev) => {
        const next = { ...prev };
        delete next[tabId];
        delete next[`${tabId}__conflict`];
        return next;
      });
      setEditorContents((prev) => {
        const next = { ...prev };
        delete next[tabId];
        return next;
      });
    }
  }, [tabs, onCloseTab]);

  const handleCloseAll = useCallback(() => {
    const hasDirty = tabs.some((t) => t.dirty);
    if (hasDirty) {
      setUnsavedModal({ tabId: "", action: "closeAll" });
    } else {
      onCloseAll();
      setContents({});
      setEditorContents({});
    }
  }, [tabs, onCloseAll]);

  const handleCloseOthers = useCallback((tabId: string) => {
    const othersDirty = tabs.some((t) => t.id !== tabId && t.dirty);
    if (othersDirty) {
      setUnsavedModal({ tabId, action: "closeOthers" });
    } else {
      onCloseOthers(tabId);
    }
  }, [tabs, onCloseOthers]);

  // Unsaved modal handlers
  const handleUnsavedSave = useCallback(async () => {
    if (!unsavedModal) return;
    const { tabId, action } = unsavedModal;

    if (action === "close") {
      await handleSave(tabId);
      onCloseTab(tabId);
    } else if (action === "closeAll") {
      for (const t of tabs) {
        if (t.dirty) await handleSave(t.id);
      }
      onCloseAll();
      setContents({});
      setEditorContents({});
    } else if (action === "closeOthers") {
      for (const t of tabs) {
        if (t.id !== tabId && t.dirty) await handleSave(t.id);
      }
      onCloseOthers(tabId);
    } else if (action === "back") {
      for (const t of tabs) {
        if (t.dirty) await handleSave(t.id);
      }
      onBack();
    }
    setUnsavedModal(null);
  }, [unsavedModal, handleSave, onCloseTab, onCloseAll, onCloseOthers, onBack, tabs]);

  const handleUnsavedDiscard = useCallback(() => {
    if (!unsavedModal) return;
    const { tabId, action } = unsavedModal;
    if (action === "close") {
      onCloseTab(tabId);
      // Cleanup content cache so reopening reloads from disk
      setContents((prev) => {
        const next = { ...prev };
        delete next[tabId];
        delete next[`${tabId}__conflict`];
        return next;
      });
      setEditorContents((prev) => {
        const next = { ...prev };
        delete next[tabId];
        return next;
      });
    } else if (action === "closeAll") {
      onCloseAll();
      setContents({});
      setEditorContents({});
    } else if (action === "closeOthers") {
      onCloseOthers(tabId);
    } else if (action === "back") {
      // Clear content caches for dirty tabs so they reload from disk on return
      const dirtyIds = tabs.filter((t) => t.dirty).map((t) => t.id);
      if (dirtyIds.length > 0) {
        setContents((prev) => {
          const next = { ...prev };
          for (const id of dirtyIds) delete next[id];
          return next;
        });
        setEditorContents((prev) => {
          const next = { ...prev };
          for (const id of dirtyIds) delete next[id];
          return next;
        });
        for (const id of dirtyIds) onMarkClean(id);
      }
      onBack();
    }
    setUnsavedModal(null);
  }, [unsavedModal, onCloseTab, onCloseAll, onCloseOthers, onBack, tabs, onMarkClean]);

  // Conflict reload
  const handleConflictReload = useCallback(() => {
    if (!conflictTab) return;
    const conflictContent = contents[`${conflictTab}__conflict`];
    if (conflictContent) {
      setContents((prev) => ({
        ...prev,
        [conflictTab]: conflictContent,
      }));
      setEditorContents((prev) => ({
        ...prev,
        [conflictTab]: conflictContent.content,
      }));
      if (conflictContent.mtime) onUpdateMtime(conflictTab, conflictContent.mtime);
      onMarkClean(conflictTab, conflictContent.mtime ?? undefined);
    }
    setConflictTab(null);
  }, [conflictTab, contents, onUpdateMtime, onMarkClean]);

  // Drag handle for resizable preview split
  const handleDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    const startX = e.clientX;
    const startWidth = previewWidth;

    const onMouseMove = (ev: MouseEvent) => {
      if (!splitContainerRef.current) return;
      const rect = splitContainerRef.current.getBoundingClientRect();
      const totalWidth = rect.width;
      const dx = ev.clientX - startX;
      // Moving right → editor bigger, preview smaller
      const newPreviewPct = startWidth - (dx / totalWidth) * 100;
      const clamped = Math.max(20, Math.min(80, newPreviewPct));
      setPreviewWidth(clamped);
    };

    const onMouseUp = () => {
      setIsDragging(false);
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
      try {
        localStorage.setItem("editor-preview-width", String(previewWidth));
      } catch { /* ignore */ }
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  }, [previewWidth]);

  // Persist preview width when it changes
  useEffect(() => {
    if (!isDragging) {
      try {
        localStorage.setItem("editor-preview-width", String(previewWidth));
      } catch { /* ignore */ }
    }
  }, [previewWidth, isDragging]);

  // Back button with unsaved check
  const handleBack = useCallback(() => {
    const hasDirty = tabs.some((t) => t.dirty);
    if (hasDirty) {
      setUnsavedModal({ tabId: "", action: "back" });
      return;
    }
    onBack();
  }, [tabs, onBack]);

  // Navigate to file from preview link
  const handlePreviewNavigate = useCallback((path: string, name: string) => {
    onOpenTab(path, name);
  }, [onOpenTab]);

  const activeContent = activeTabId ? contents[activeTabId] : null;
  const activeEditorContent = activeTabId ? editorContents[activeTabId] : undefined;
  const previewType = activeTab ? getPreviewType(activeTab.name) : null;
  const canPreview = activeTab ? isPreviewable(activeTab.name) : false;
  const currentPreviewMode = (activeTabId && previewModes[activeTabId]) || "code";
  const showPreview = currentPreviewMode !== "code";
  const previewFullscreen = currentPreviewMode === "preview";
  const isSplit = showPreview && canPreview && !isMobile && !previewFullscreen;

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        if (!isGuest) handleSave();
      }
      if (e.altKey && e.key === "w") {
        e.preventDefault();
        if (activeTabId) handleTabClose(activeTabId);
      }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "v") {
        e.preventDefault();
        if (canPreview && activeTabId) {
          // Cycle: code → split → preview → code
          setPreviewModes((p) => {
            const cur = p[activeTabId] || "code";
            const next = cur === "code" ? "split" : cur === "split" ? "preview" : "code";
            return { ...p, [activeTabId]: next };
          });
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isGuest, handleSave, activeTabId, handleTabClose, showPreview, canPreview]);

  return (
    <div className="flex flex-col w-full h-full bg-background rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border shrink-0">
        <button
          onClick={handleBack}
          className="flex items-center gap-1 px-2 py-1 -ml-2 rounded-md text-muted-fg hover:text-foreground hover:bg-surface-hover transition-colors cursor-pointer text-sm"
          aria-label="Назад к файлам"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="hidden sm:inline">Назад</span>
        </button>

        <div className="flex-1 min-w-0 text-center">
          <span className="text-sm font-medium text-foreground truncate" title={activeTab?.path || ""}>
            {activeTab ? (activeTab.name.includes("/") ? activeTab.name.split("/").pop() : activeTab.name) : ""}
          </span>
          {activeTab?.dirty && (
            <span className="text-xs text-warning ml-1.5">(изменён)</span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {/* Preview mode buttons: Code / Split / Preview */}
          {canPreview && !isMobile && (
            <div className="flex items-center rounded-md border border-border overflow-hidden">
              <button
                onClick={() => setPreviewModes((p) => ({ ...p, [activeTabId!]: "code" }))}
                className={`p-1.5 transition-colors cursor-pointer ${
                  currentPreviewMode === "code" ? "text-accent-fg bg-accent/20" : "text-muted-fg hover:text-foreground hover:bg-surface-hover"
                }`}
                title="Только код"
                aria-label="Только код"
              >
                <Code className="w-4 h-4" />
              </button>
              <button
                onClick={() => setPreviewModes((p) => ({ ...p, [activeTabId!]: "split" }))}
                className={`p-1.5 border-x border-border transition-colors cursor-pointer ${
                  currentPreviewMode === "split" ? "text-accent-fg bg-accent/20" : "text-muted-fg hover:text-foreground hover:bg-surface-hover"
                }`}
                title="Разделённый вид"
                aria-label="Разделённый вид"
              >
                <Columns className="w-4 h-4" />
              </button>
              <button
                onClick={() => setPreviewModes((p) => ({ ...p, [activeTabId!]: "preview" }))}
                className={`p-1.5 transition-colors cursor-pointer ${
                  currentPreviewMode === "preview" ? "text-accent-fg bg-accent/20" : "text-muted-fg hover:text-foreground hover:bg-surface-hover"
                }`}
                title="Только превью"
                aria-label="Только превью"
              >
                <Eye className="w-4 h-4" />
              </button>
            </div>
          )}
          {/* Mobile: simple toggle */}
          {canPreview && isMobile && (
            <button
              onClick={() => setPreviewModes((p) => ({
                ...p,
                [activeTabId!]: currentPreviewMode === "code" ? "preview" : "code"
              }))}
              className={`p-1.5 rounded transition-colors cursor-pointer ${
                currentPreviewMode !== "code" ? "text-accent-fg bg-accent/20" : "text-muted-fg hover:text-foreground"
              }`}
              title={currentPreviewMode !== "code" ? "Код" : "Превью"}
            >
              {currentPreviewMode !== "code" ? <Code className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          )}

          {/* Save button */}
          {!isGuest && (
            <button
              onClick={() => handleSave()}
              disabled={!activeTab?.dirty || saving}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs transition-all cursor-pointer ${
                activeTab?.dirty && !saving
                  ? "bg-accent/20 text-accent-fg hover:bg-accent/30"
                  : "text-muted opacity-30 cursor-not-allowed"
              }`}
            >
              <Save className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{saving ? "..." : "Сохранить"}</span>
            </button>
          )}
        </div>
      </div>

      {/* Tab bar */}
      <TabBar
        tabs={tabs}
        activeTabId={activeTabId}
        onSelect={onSelectTab}
        onClose={handleTabClose}
        onCloseOthers={handleCloseOthers}
        onCloseAll={handleCloseAll}
        onAdd={onAddFile || onBack}
      />

      {/* Conflict banner */}
      {conflictTab === activeTabId && (
        <div className="px-4 py-2 bg-warning/10 border-b border-warning/20 flex items-center justify-between">
          <p className="text-warning text-xs">Файл был изменён извне</p>
          <div className="flex gap-2">
            <button
              onClick={() => setConflictTab(null)}
              className="text-xs text-muted-fg hover:text-foreground cursor-pointer"
            >
              Игнорировать
            </button>
            <button
              onClick={handleConflictReload}
              className="text-xs text-accent-fg hover:text-accent-fg/80 cursor-pointer"
            >
              Перезагрузить
            </button>
          </div>
        </div>
      )}

      {/* Content area */}
      <div ref={splitContainerRef} className={`flex-1 min-h-0 flex${isDragging ? " select-none" : ""}`}>
        {activeContent?.loading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="animate-spin h-6 w-6 border-2 border-accent border-t-transparent rounded-full" />
          </div>
        ) : activeContent?.error ? (
          <div className="flex-1 flex items-center justify-center px-4">
            <p className="text-danger text-sm text-center">{activeContent.error}</p>
          </div>
        ) : activeTab && activeEditorContent !== undefined ? (
          <>
            {/* Editor — hidden in fullscreen preview, fixed width in split, flex-1 in code-only */}
            <div
              className={`${
                previewFullscreen && canPreview ? "hidden" :
                isSplit ? "border-r border-border" : "flex-1"
              } min-h-0 overflow-hidden`}
              style={
                isSplit
                  ? { width: `${100 - previewWidth}%`, flexShrink: 0, flexGrow: 0, flexBasis: `${100 - previewWidth}%` }
                  : undefined
              }
            >
              <CodeEditor
                key={activeTab.id}
                content={activeContent?.content || ""}
                filename={activeTab.name}
                readOnly={isGuest}
                onChange={(c) => handleChange(activeTab.id, c)}
                onSave={(c) => {
                  setEditorContents((prev) => ({ ...prev, [activeTab.id]: c }));
                  handleSave(activeTab.id);
                }}
              />
            </div>

            {/* Drag handle — only in split mode */}
            {isSplit && (
              <div
                onMouseDown={handleDragStart}
                className={`w-1.5 cursor-col-resize shrink-0 transition-colors ${
                  isDragging ? "bg-accent" : "bg-border hover:bg-accent/50"
                }`}
              />
            )}

            {/* Preview — flex-1 in fullscreen/mobile, fixed width in split */}
            {showPreview && canPreview && (
              <div
                className={`${isMobile || previewFullscreen ? "flex-1" : ""} min-h-0 overflow-hidden`}
                style={{
                  ...(isSplit ? { width: `${previewWidth}%`, flexShrink: 0, flexGrow: 0, flexBasis: `${previewWidth}%` } : {}),
                  ...(isDragging ? { pointerEvents: "none" as const } : {}),
                }}
              >
                <PreviewPanel
                  content={activeEditorContent}
                  previewType={previewType}
                  sessionId={sessionId}
                  filePath={activeTab.path}
                  onNavigate={handlePreviewNavigate}
                />
              </div>
            )}
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-muted-fg text-sm">Выберите файл для редактирования</p>
          </div>
        )}
      </div>

      {/* Unsaved changes modal */}
      <UnsavedChangesModal
        open={!!unsavedModal}
        fileName={unsavedModal ? tabs.find((t) => t.id === unsavedModal.tabId)?.name : undefined}
        onSave={handleUnsavedSave}
        onDiscard={handleUnsavedDiscard}
        onCancel={() => setUnsavedModal(null)}
      />
    </div>
  );
}

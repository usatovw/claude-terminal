"use client";

import { useReducer, useCallback, useEffect, useRef } from "react";

export interface EditorTab {
  id: string; // Unique key: relativePath
  path: string; // Relative path to file
  name: string; // Display name (filename)
  dirty: boolean;
  mtime: number | null; // Last known mtime from server
}

export interface TabsState {
  tabs: EditorTab[];
  activeTabId: string | null;
  showEditor: boolean;
}

const MAX_TABS = 20;

type TabAction =
  | { type: "OPEN_TAB"; path: string; name: string; mtime?: number }
  | { type: "CLOSE_TAB"; id: string }
  | { type: "SET_ACTIVE"; id: string }
  | { type: "MARK_DIRTY"; id: string }
  | { type: "MARK_CLEAN"; id: string; mtime?: number }
  | { type: "UPDATE_MTIME"; id: string; mtime: number }
  | { type: "CLOSE_OTHERS"; id: string }
  | { type: "CLOSE_ALL" }
  | { type: "CLOSE_SAVED" }
  | { type: "SHOW_EDITOR" }
  | { type: "HIDE_EDITOR" }
  | { type: "RESTORE"; state: TabsState };

function tabsReducer(state: TabsState, action: TabAction): TabsState {
  switch (action.type) {
    case "OPEN_TAB": {
      const id = action.path;
      const existing = state.tabs.find((t) => t.id === id);
      if (existing) {
        return { ...state, activeTabId: id, showEditor: true };
      }

      let tabs = [...state.tabs];

      // Enforce max tabs: close oldest non-dirty tab
      if (tabs.length >= MAX_TABS) {
        const closeable = tabs.find((t) => !t.dirty && t.id !== state.activeTabId);
        if (closeable) {
          tabs = tabs.filter((t) => t.id !== closeable.id);
        }
      }

      const newTab: EditorTab = {
        id,
        path: action.path,
        name: action.name,
        dirty: false,
        mtime: action.mtime ?? null,
      };

      return {
        tabs: [...tabs, newTab],
        activeTabId: id,
        showEditor: true,
      };
    }

    case "CLOSE_TAB": {
      const idx = state.tabs.findIndex((t) => t.id === action.id);
      if (idx === -1) return state;

      const newTabs = state.tabs.filter((t) => t.id !== action.id);
      let newActive = state.activeTabId;

      if (state.activeTabId === action.id) {
        if (newTabs.length === 0) {
          newActive = null;
        } else if (idx < newTabs.length) {
          newActive = newTabs[idx].id;
        } else {
          newActive = newTabs[newTabs.length - 1].id;
        }
      }

      return {
        tabs: newTabs,
        activeTabId: newActive,
        showEditor: newTabs.length > 0 ? state.showEditor : false,
      };
    }

    case "SET_ACTIVE": {
      if (!state.tabs.find((t) => t.id === action.id)) return state;
      return { ...state, activeTabId: action.id };
    }

    case "MARK_DIRTY": {
      return {
        ...state,
        tabs: state.tabs.map((t) =>
          t.id === action.id ? { ...t, dirty: true } : t
        ),
      };
    }

    case "MARK_CLEAN": {
      return {
        ...state,
        tabs: state.tabs.map((t) =>
          t.id === action.id
            ? { ...t, dirty: false, mtime: action.mtime ?? t.mtime }
            : t
        ),
      };
    }

    case "UPDATE_MTIME": {
      return {
        ...state,
        tabs: state.tabs.map((t) =>
          t.id === action.id ? { ...t, mtime: action.mtime } : t
        ),
      };
    }

    case "CLOSE_OTHERS": {
      const keep = state.tabs.filter((t) => t.id === action.id);
      return { tabs: keep, activeTabId: action.id, showEditor: state.showEditor };
    }

    case "CLOSE_ALL": {
      return { tabs: [], activeTabId: null, showEditor: false };
    }

    case "CLOSE_SAVED": {
      const dirty = state.tabs.filter((t) => t.dirty);
      const newActive = dirty.length > 0
        ? (dirty.find((t) => t.id === state.activeTabId)?.id ?? dirty[0].id)
        : null;
      return {
        tabs: dirty,
        activeTabId: newActive,
        showEditor: dirty.length > 0 ? state.showEditor : false,
      };
    }

    case "SHOW_EDITOR": {
      return { ...state, showEditor: true };
    }

    case "HIDE_EDITOR": {
      return { ...state, showEditor: false };
    }

    case "RESTORE": {
      return action.state;
    }

    default:
      return state;
  }
}

const INITIAL_STATE: TabsState = { tabs: [], activeTabId: null, showEditor: false };

export function useEditorTabs(sessionId: string) {
  const storageKey = `editor-tabs-${sessionId}`;
  const initialized = useRef(false);

  const [state, dispatch] = useReducer(tabsReducer, INITIAL_STATE);

  // Restore from sessionStorage on mount
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    try {
      const saved = sessionStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved) as TabsState;
        // Restore tabs but clear dirty flags (content will be reloaded)
        const cleanedTabs = parsed.tabs.map((t) => ({ ...t, dirty: false }));
        dispatch({
          type: "RESTORE",
          state: {
            tabs: cleanedTabs,
            activeTabId: parsed.activeTabId,
            showEditor: (parsed.showEditor ?? false) && cleanedTabs.length > 0,
          },
        });
      }
    } catch {
      // Ignore
    }
  }, [storageKey]);

  // Persist to sessionStorage on change
  useEffect(() => {
    if (!initialized.current) return;
    try {
      sessionStorage.setItem(
        storageKey,
        JSON.stringify({ tabs: state.tabs, activeTabId: state.activeTabId, showEditor: state.showEditor })
      );
    } catch {
      // Ignore
    }
  }, [state.tabs, state.activeTabId, state.showEditor, storageKey]);

  const openTab = useCallback(
    (path: string, name: string, mtime?: number) => {
      dispatch({ type: "OPEN_TAB", path, name, mtime });
    },
    []
  );

  const closeTab = useCallback((id: string) => {
    dispatch({ type: "CLOSE_TAB", id });
  }, []);

  const setActiveTab = useCallback((id: string) => {
    dispatch({ type: "SET_ACTIVE", id });
  }, []);

  const markDirty = useCallback((id: string) => {
    dispatch({ type: "MARK_DIRTY", id });
  }, []);

  const markClean = useCallback((id: string, mtime?: number) => {
    dispatch({ type: "MARK_CLEAN", id, mtime });
  }, []);

  const updateMtime = useCallback((id: string, mtime: number) => {
    dispatch({ type: "UPDATE_MTIME", id, mtime });
  }, []);

  const closeOthers = useCallback((id: string) => {
    dispatch({ type: "CLOSE_OTHERS", id });
  }, []);

  const closeAll = useCallback(() => {
    dispatch({ type: "CLOSE_ALL" });
  }, []);

  const closeSaved = useCallback(() => {
    dispatch({ type: "CLOSE_SAVED" });
  }, []);

  const hideEditor = useCallback(() => {
    dispatch({ type: "HIDE_EDITOR" });
  }, []);

  const showEditorView = useCallback(() => {
    dispatch({ type: "SHOW_EDITOR" });
  }, []);

  const hasDirtyTabs = state.tabs.some((t) => t.dirty);

  const activeTab = state.activeTabId
    ? state.tabs.find((t) => t.id === state.activeTabId) ?? null
    : null;

  return {
    tabs: state.tabs,
    activeTabId: state.activeTabId,
    activeTab,
    showEditor: state.showEditor,
    hasDirtyTabs,
    openTab,
    closeTab,
    setActiveTab,
    markDirty,
    markClean,
    updateMtime,
    closeOthers,
    closeAll,
    closeSaved,
    hideEditor,
    showEditorView,
  };
}

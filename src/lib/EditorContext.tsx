"use client";

import { createContext, useContext, useState, useCallback } from "react";

interface EditorContextValue {
  hasUnsavedChanges: boolean;
  setHasUnsavedChanges: (v: boolean) => void;
  /** Request to close/navigate away — returns true if allowed */
  requestClose: () => Promise<boolean>;
  /** Set the handler for close requests (provided by EditorWorkspace) */
  setCloseHandler: (handler: (() => Promise<boolean>) | null) => void;
}

const EditorContext = createContext<EditorContextValue>({
  hasUnsavedChanges: false,
  setHasUnsavedChanges: () => {},
  requestClose: async () => true,
  setCloseHandler: () => {},
});

export function useEditor() {
  return useContext(EditorContext);
}

export function EditorProvider({ children }: { children: React.ReactNode }) {
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [closeHandler, setCloseHandlerState] = useState<(() => Promise<boolean>) | null>(null);

  const requestClose = useCallback(async () => {
    if (!hasUnsavedChanges) return true;
    if (closeHandler) return closeHandler();
    return true;
  }, [hasUnsavedChanges, closeHandler]);

  const setCloseHandler = useCallback((handler: (() => Promise<boolean>) | null) => {
    setCloseHandlerState(() => handler);
  }, []);

  return (
    <EditorContext.Provider
      value={{ hasUnsavedChanges, setHasUnsavedChanges, requestClose, setCloseHandler }}
    >
      {children}
    </EditorContext.Provider>
  );
}

"use client";

import { createContext, useContext, useState, useCallback, useRef } from "react";

interface TerminalScrollState {
  viewportY: number;   // line index at top of viewport
  rows: number;        // visible rows count
  totalLines: number;  // total buffer lines
}

interface TerminalScrollContextValue {
  scroll: TerminalScrollState;
  updateScroll: (state: TerminalScrollState) => void;
  scrollToLine: (line: number) => void;
  registerScrollFn: (fn: ((line: number) => void) | null) => void;
}

const TerminalScrollContext = createContext<TerminalScrollContextValue | null>(null);

export function useTerminalScroll() {
  const ctx = useContext(TerminalScrollContext);
  if (!ctx) throw new Error("useTerminalScroll must be used within TerminalScrollProvider");
  return ctx;
}

export function TerminalScrollProvider({ children }: { children: React.ReactNode }) {
  const [scroll, setScroll] = useState<TerminalScrollState>({
    viewportY: 0,
    rows: 0,
    totalLines: 0,
  });
  const scrollFnRef = useRef<((line: number) => void) | null>(null);

  const updateScroll = useCallback((state: TerminalScrollState) => {
    setScroll(state);
  }, []);

  const scrollToLine = useCallback((line: number) => {
    scrollFnRef.current?.(line);
  }, []);

  const registerScrollFn = useCallback((fn: ((line: number) => void) | null) => {
    scrollFnRef.current = fn;
  }, []);

  return (
    <TerminalScrollContext.Provider value={{ scroll, updateScroll, scrollToLine, registerScrollFn }}>
      {children}
    </TerminalScrollContext.Provider>
  );
}

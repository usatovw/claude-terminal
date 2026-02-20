"use client";

import { useState, useCallback } from "react";
import dynamic from "next/dynamic";
import Navbar from "@/components/Navbar";
import SessionList from "@/components/SessionList";

const Terminal = dynamic(() => import("@/components/Terminal"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full">
      <div className="animate-spin h-8 w-8 border-2 border-violet-500 border-t-transparent rounded-full" />
    </div>
  ),
});

export default function Dashboard() {
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [terminalKey, setTerminalKey] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const handleSelectSession = useCallback((sessionId: string) => {
    setActiveSessionId(sessionId);
    setTerminalKey((k) => k + 1);
  }, []);

  const handleSessionDeleted = useCallback((sessionId: string) => {
    if (activeSessionId === sessionId) {
      setActiveSessionId(null);
    }
  }, [activeSessionId]);

  const handleNewSession = useCallback(async () => {
    try {
      const res = await fetch("/api/sessions", { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setActiveSessionId(data.sessionId);
        setTerminalKey((k) => k + 1);
      }
    } catch {
      // Ignore
    }
  }, []);

  return (
    <div className="flex h-screen bg-black">
      {/* Sidebar */}
      <div
        className={`${
          sidebarOpen ? "w-72" : "w-0"
        } transition-all duration-200 border-r border-zinc-800 bg-zinc-950 overflow-hidden flex-shrink-0`}
      >
        <SessionList
          activeSessionId={activeSessionId}
          onSelectSession={handleSelectSession}
          onSessionDeleted={handleSessionDeleted}
          onNewSession={handleNewSession}
        />
      </div>

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0">
        <Navbar activeSessionId={activeSessionId} />

        {/* Toggle sidebar button */}
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="absolute top-4 left-2 z-20 text-zinc-500 hover:text-zinc-300 transition-colors"
          style={{ left: sidebarOpen ? "calc(18rem + 8px)" : "8px" }}
        >
          {sidebarOpen ? "◀" : "▶"}
        </button>

        {/* Terminal area */}
        <div className="flex-1 relative">
          {activeSessionId ? (
            <div className="absolute inset-0 m-2">
              <div className="w-full h-full rounded-xl border border-zinc-800 overflow-hidden bg-[#0a0a0a]">
                <Terminal key={terminalKey} sessionId={activeSessionId} />
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500/20 to-indigo-600/20 flex items-center justify-center text-violet-400 text-2xl mx-auto mb-4">
                  C
                </div>
                <h2 className="text-xl font-medium text-zinc-300 mb-2">
                  Добро пожаловать
                </h2>
                <p className="text-zinc-500 mb-6 max-w-sm">
                  Создайте новую сессию или выберите существующую из списка
                  слева.
                </p>
                <button
                  onClick={handleNewSession}
                  className="px-6 py-3 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white rounded-xl font-medium transition-all duration-200 hover:shadow-lg hover:shadow-violet-500/25"
                >
                  + Начать общение
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

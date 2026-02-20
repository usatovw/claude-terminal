"use client";

import { useState, useCallback, useEffect } from "react";
import dynamic from "next/dynamic";
import Navbar from "@/components/Navbar";
import SessionList from "@/components/SessionList";
import { Button as MovingBorderButton } from "@/components/ui/moving-border";
import { TypewriterEffect } from "@/components/ui/typewriter-effect";
import { ChevronLeft, ChevronRight, Maximize, Minimize } from "@/components/Icons";

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
  const [fullscreen, setFullscreen] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<
    "connected" | "disconnected" | "idle"
  >("idle");
  const [sessionCount, setSessionCount] = useState({ total: 0, active: 0 });

  // Fetch session counts
  useEffect(() => {
    const fetchCounts = async () => {
      try {
        const res = await fetch("/api/sessions");
        if (res.ok) {
          const data = await res.json();
          setSessionCount({
            total: data.sessions.length,
            active: data.sessions.filter(
              (s: { isActive: boolean }) => s.isActive
            ).length,
          });
        }
      } catch {
        // Ignore
      }
    };
    fetchCounts();
    const interval = setInterval(fetchCounts, 5000);
    return () => clearInterval(interval);
  }, []);

  // Warn before closing tab with active session
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (activeSessionId && connectionStatus === "connected") {
        e.preventDefault();
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [activeSessionId, connectionStatus]);

  // Escape to exit fullscreen
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && fullscreen) {
        setFullscreen(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [fullscreen]);

  const handleSelectSession = useCallback((sessionId: string) => {
    setActiveSessionId(sessionId);
    setTerminalKey((k) => k + 1);
    setConnectionStatus("idle");
  }, []);

  const handleSessionDeleted = useCallback(
    (sessionId: string) => {
      if (activeSessionId === sessionId) {
        setActiveSessionId(null);
        setConnectionStatus("idle");
      }
    },
    [activeSessionId]
  );

  const handleNewSession = useCallback(async () => {
    try {
      const res = await fetch("/api/sessions", { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setActiveSessionId(data.sessionId);
        setTerminalKey((k) => k + 1);
        setConnectionStatus("idle");
      }
    } catch {
      // Ignore
    }
  }, []);

  const handleConnectionChange = useCallback(
    (status: "connected" | "disconnected") => {
      setConnectionStatus(status);
    },
    []
  );

  return (
    <div className="flex h-screen bg-black">
      {/* Sidebar */}
      {!fullscreen && (
        <div
          className={`${
            sidebarOpen ? "w-72" : "w-0"
          } transition-all duration-200 border-r border-zinc-800/30 bg-zinc-950/90 overflow-hidden flex-shrink-0`}
        >
          <SessionList
            activeSessionId={activeSessionId}
            onSelectSession={handleSelectSession}
            onSessionDeleted={handleSessionDeleted}
            onNewSession={handleNewSession}
          />
        </div>
      )}

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0">
        {!fullscreen && (
          <Navbar
            activeSessionId={activeSessionId}
            connectionStatus={connectionStatus}
            sessionCount={sessionCount}
          />
        )}

        {/* Sidebar toggle */}
        {!fullscreen && (
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="absolute top-3 z-20 text-zinc-600 hover:text-zinc-400 transition-colors p-1"
            style={{ left: sidebarOpen ? "calc(18rem + 4px)" : "4px" }}
          >
            {sidebarOpen ? (
              <ChevronLeft className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
          </button>
        )}

        {/* Terminal area */}
        <div className="flex-1 relative">
          {activeSessionId ? (
            <div className={`absolute inset-0 ${fullscreen ? "m-0" : "m-2"}`}>
              {/* Fullscreen toggle */}
              <button
                onClick={() => setFullscreen(!fullscreen)}
                className="absolute top-2 right-2 z-10 p-1.5 text-zinc-600 hover:text-zinc-300 transition-colors bg-zinc-900/80 rounded-md backdrop-blur-sm"
                title={fullscreen ? "Выйти из полноэкранного" : "Полноэкранный режим"}
              >
                {fullscreen ? (
                  <Minimize className="w-4 h-4" />
                ) : (
                  <Maximize className="w-4 h-4" />
                )}
              </button>

              <MovingBorderButton
                as="div"
                borderRadius="0.75rem"
                containerClassName="w-full h-full"
                borderClassName="bg-[radial-gradient(var(--violet-500)_40%,transparent_60%)]"
                className="w-full h-full bg-[#0a0a0a] p-0 overflow-hidden"
                duration={8000}
              >
                <Terminal
                  key={terminalKey}
                  sessionId={activeSessionId}
                  onConnectionChange={handleConnectionChange}
                />
              </MovingBorderButton>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center max-w-md">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500/20 to-indigo-600/20 flex items-center justify-center text-violet-400 text-2xl mx-auto mb-6 border border-violet-500/10">
                  C
                </div>
                <div className="mb-4">
                  <TypewriterEffect
                    words={[
                      { text: "Claude", className: "text-white" },
                      { text: "Terminal", className: "text-violet-400" },
                    ]}
                    className="text-2xl"
                  />
                </div>
                <p className="text-zinc-500 mb-8 text-sm leading-relaxed">
                  Создайте новую сессию или выберите существующую из списка
                  слева
                </p>
                <button
                  onClick={handleNewSession}
                  className="px-6 py-3 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white rounded-xl text-sm font-medium transition-all duration-200 hover:shadow-lg hover:shadow-violet-500/20"
                >
                  Начать общение
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

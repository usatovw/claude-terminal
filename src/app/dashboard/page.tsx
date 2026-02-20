"use client";

import { useState, useCallback, useEffect } from "react";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "motion/react";
import Navbar from "@/components/Navbar";
import SessionList from "@/components/SessionList";
import { Button as MovingBorderButton } from "@/components/ui/moving-border";
import { TypewriterEffect } from "@/components/ui/typewriter-effect";
import { TextGenerateEffect } from "@/components/ui/text-generate-effect";
import { FlipWords } from "@/components/ui/flip-words";
import { Spotlight } from "@/components/ui/spotlight";
import { HoverBorderGradient } from "@/components/ui/hover-border-gradient";
import { ChevronLeft, ChevronRight, Maximize, Minimize, X } from "@/components/Icons";

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
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
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
    setMobileSidebarOpen(false);
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
        setMobileSidebarOpen(false);
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
      {/* Desktop sidebar */}
      {!fullscreen && (
        <div
          className={`hidden md:block ${
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

      {/* Mobile sidebar overlay */}
      <AnimatePresence>
        {mobileSidebarOpen && !fullscreen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 bg-black/60 z-30 md:hidden"
              onClick={() => setMobileSidebarOpen(false)}
            />
            {/* Drawer */}
            <motion.div
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="fixed top-0 left-0 bottom-0 w-72 z-40 bg-zinc-950 border-r border-zinc-800/30 md:hidden"
            >
              {/* Close button */}
              <div className="absolute top-3 right-3 z-50">
                <button
                  onClick={() => setMobileSidebarOpen(false)}
                  className="p-2 text-zinc-400 hover:text-zinc-200 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <SessionList
                activeSessionId={activeSessionId}
                onSelectSession={handleSelectSession}
                onSessionDeleted={handleSessionDeleted}
                onNewSession={handleNewSession}
              />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0">
        {!fullscreen && (
          <Navbar
            activeSessionId={activeSessionId}
            connectionStatus={connectionStatus}
            sessionCount={sessionCount}
            onMenuClick={() => setMobileSidebarOpen(true)}
          />
        )}

        {/* Desktop sidebar toggle */}
        {!fullscreen && (
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="hidden md:flex absolute top-3 z-20 items-center justify-center w-7 h-7 rounded-md text-zinc-600 hover:text-zinc-400 hover:bg-zinc-800/80 transition-all"
            style={{ left: sidebarOpen ? "calc(18rem + 4px)" : "4px" }}
            title={sidebarOpen ? "Скрыть панель" : "Показать панель"}
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
            <div className={`absolute inset-0 ${fullscreen ? "m-0" : "m-1 md:m-2"}`}>
              {/* Fullscreen toggle */}
              <button
                onClick={() => setFullscreen(!fullscreen)}
                className="absolute top-2 right-2 z-10 p-2 md:p-1.5 text-zinc-600 hover:text-zinc-300 transition-colors bg-zinc-900/80 rounded-md backdrop-blur-sm"
                title={fullscreen ? "Выйти из полноэкранного" : "Полноэкранный режим"}
              >
                {fullscreen ? (
                  <Minimize className="w-5 h-5 md:w-4 md:h-4" />
                ) : (
                  <Maximize className="w-5 h-5 md:w-4 md:h-4" />
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
                  fullscreen={fullscreen}
                  onConnectionChange={handleConnectionChange}
                />
              </MovingBorderButton>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full relative overflow-hidden px-4">
              {/* Spotlight background */}
              <Spotlight
                className="-top-40 left-0 md:left-60 md:-top-20"
                fill="rgba(139, 92, 246, 0.15)"
              />

              <div className="text-center max-w-md relative z-10">
                <div className="mb-4">
                  <TypewriterEffect
                    words={[
                      { text: "Claude", className: "text-white" },
                      { text: "Terminal", className: "text-violet-400" },
                    ]}
                    className="text-xl md:text-2xl"
                    cursorClassName="bg-violet-500"
                  />
                </div>

                <div className="mb-2 text-zinc-400 text-sm md:text-base">
                  <FlipWords
                    words={["Создавайте", "Исследуйте", "Автоматизируйте", "Стройте"]}
                    className="text-violet-400"
                  />
                  <span> с помощью AI</span>
                </div>

                <div className="mb-8">
                  <TextGenerateEffect
                    words="Создайте новую сессию или выберите существующую из списка слева"
                    className="text-zinc-500 text-sm leading-relaxed"
                  />
                </div>

                <HoverBorderGradient
                  as="button"
                  containerClassName="mx-auto"
                  className="flex items-center justify-center gap-2 bg-zinc-950 text-white px-6 py-3 text-sm font-medium"
                  onClick={handleNewSession}
                >
                  Начать общение
                </HoverBorderGradient>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

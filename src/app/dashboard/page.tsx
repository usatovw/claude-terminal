"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import Navbar, { ViewMode } from "@/components/Navbar";
import SessionList from "@/components/SessionList";
import FileManager from "@/components/FileManager";
import StoppedSessionOverlay from "@/components/StoppedSessionOverlay";
import { Button as MovingBorderButton } from "@/components/ui/moving-border";
import { TypewriterEffect } from "@/components/ui/typewriter-effect";
import { TextGenerateEffect } from "@/components/ui/text-generate-effect";
import { FlipWords } from "@/components/ui/flip-words";
import { Spotlight } from "@/components/ui/spotlight";
import { HoverBorderGradient } from "@/components/ui/hover-border-gradient";
import { Maximize, Minimize, X } from "@/components/Icons";
import PresenceProvider, { usePresence } from "@/components/presence/PresenceProvider";
import CursorOverlay from "@/components/presence/CursorOverlay";
import { UserProvider } from "@/lib/UserContext";
import ChatPanel from "@/components/chat/ChatPanel";
import ImageLightbox from "@/components/chat/ImageLightbox";

const Terminal = dynamic(() => import("@/components/Terminal"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full">
      <div className="animate-spin h-8 w-8 border-2 border-violet-500 border-t-transparent rounded-full" />
    </div>
  ),
});

export default function Dashboard() {
  return (
    <UserProvider>
      <PresenceProvider>
        <DashboardInner />
      </PresenceProvider>
    </UserProvider>
  );
}

function DashboardInner() {
  const router = useRouter();
  const { joinSession: presenceJoin } = usePresence();
  const contentRef = useRef<HTMLDivElement>(null);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [terminalKey, setTerminalKey] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<
    "connected" | "disconnected" | "idle"
  >("idle");
  const [sessions, setSessions] = useState<Array<{sessionId: string; displayName: string | null; isActive: boolean}>>([]);
  const [viewMode, setViewMode] = useState<ViewMode>("terminal");
  const [resumingSessionId, setResumingSessionId] = useState<string | null>(null);
  const [creatingSession, setCreatingSession] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  const sessionCount = {
    total: sessions.length,
    active: sessions.filter((s) => s.isActive).length,
  };

  const activeSession = activeSessionId
    ? sessions.find((s) => s.sessionId === activeSessionId)
    : null;
  const activeSessionName = activeSession?.displayName || null;
  const isActiveSessionStopped = activeSession ? !activeSession.isActive : false;

  // Fetch sessions
  useEffect(() => {
    const fetchSessions = async () => {
      try {
        const res = await fetch("/api/sessions");
        if (res.ok) {
          const data = await res.json();
          setSessions(data.sessions);
        }
      } catch {
        // Ignore
      }
    };
    fetchSessions();
    const interval = setInterval(fetchSessions, 5000);
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

  // Sync active session to presence
  useEffect(() => {
    if (activeSessionId) presenceJoin(activeSessionId);
  }, [activeSessionId, presenceJoin]);

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

  const handleLogout = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
  }, [router]);

  const handleSelectSession = useCallback((sessionId: string) => {
    setActiveSessionId(sessionId);
    setTerminalKey((k) => k + 1);
    setConnectionStatus("idle");
    setMobileSidebarOpen(false);
    setViewMode("terminal");
  }, []);

  const handleSessionDeleted = useCallback(
    (sessionId: string) => {
      if (activeSessionId === sessionId) {
        setActiveSessionId(null);
        setConnectionStatus("idle");
        setViewMode("terminal");
      }
    },
    [activeSessionId]
  );

  const handleNewSession = useCallback(async () => {
    setCreatingSession(true);
    try {
      const res = await fetch("/api/sessions", { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setActiveSessionId(data.sessionId);
        setTerminalKey((k) => k + 1);
        setConnectionStatus("idle");
        setMobileSidebarOpen(false);
        setViewMode("terminal");
      }
    } catch {
      // Ignore
    } finally {
      setCreatingSession(false);
    }
  }, []);

  const handleConnectionChange = useCallback(
    (status: "connected" | "disconnected") => {
      setConnectionStatus(status);
    },
    []
  );

  const handleOpenFiles = useCallback((sessionId: string) => {
    setActiveSessionId(sessionId);
    setViewMode("files");
    setMobileSidebarOpen(false);
  }, []);

  const handleSwitchView = useCallback((mode: ViewMode) => {
    setViewMode(mode);
    if (mode === "terminal") {
      setTerminalKey((k) => k + 1);
    }
  }, []);

  const handleResumeSession = useCallback(async (sessionId?: string) => {
    const targetId = sessionId || activeSessionId;
    if (!targetId) return;
    setResumingSessionId(targetId);
    try {
      await fetch(`/api/sessions/${targetId}`, { method: "PUT" });
      setSessions((prev) =>
        prev.map((s) =>
          s.sessionId === targetId ? { ...s, isActive: true } : s
        )
      );
      setActiveSessionId(targetId);
      setTerminalKey((k) => k + 1);
      setConnectionStatus("idle");
      setMobileSidebarOpen(false);
      setViewMode("terminal");
    } finally {
      setResumingSessionId(null);
    }
  }, [activeSessionId]);

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
            onOpenFiles={handleOpenFiles}
            onResumeSession={handleResumeSession}
            resumingSessionId={resumingSessionId}
            creatingSession={creatingSession}
            onLogout={handleLogout}
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
                onOpenFiles={handleOpenFiles}
                onResumeSession={handleResumeSession}
                resumingSessionId={resumingSessionId}
                onLogout={handleLogout}
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
            activeSessionName={activeSessionName}
            connectionStatus={connectionStatus}
            sessionCount={sessionCount}
            sidebarOpen={sidebarOpen}
            onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
            onMenuClick={() => setMobileSidebarOpen(true)}
            viewMode={viewMode}
            onSwitchView={handleSwitchView}
            chatOpen={chatOpen}
            onToggleChat={() => setChatOpen(!chatOpen)}
          />
        )}

        {/* Content area */}
        <div className="flex-1 relative">
          {activeSessionId ? (
            viewMode === "files" ? (
              /* File Manager */
              <div className="absolute inset-0 m-1 md:m-2">
                <MovingBorderButton
                  as="div"
                  borderRadius="0.75rem"
                  containerClassName="w-full h-full"
                  borderClassName="bg-[radial-gradient(var(--violet-500)_40%,transparent_60%)]"
                  className="w-full h-full bg-[#0a0a0a] p-0 overflow-hidden"
                  duration={8000}
                >
                  <FileManager sessionId={activeSessionId} />
                </MovingBorderButton>
              </div>
            ) : isActiveSessionStopped ? (
              /* Stopped session overlay */
              <div className="absolute inset-0 m-1 md:m-2">
                <MovingBorderButton
                  as="div"
                  borderRadius="0.75rem"
                  containerClassName="w-full h-full"
                  borderClassName="bg-[radial-gradient(var(--violet-500)_40%,transparent_60%)]"
                  className="w-full h-full bg-[#0a0a0a] p-0 overflow-hidden"
                  duration={8000}
                >
                  <StoppedSessionOverlay
                    sessionName={activeSessionName || activeSessionId}
                    onResume={handleResumeSession}
                    resuming={resumingSessionId === activeSessionId}
                  />
                </MovingBorderButton>
              </div>
            ) : (
              /* Terminal — presence system lives here ONLY */
              <div
                ref={contentRef}
                className={`absolute inset-0 ${fullscreen ? "m-0" : "m-1 md:m-2"} presence-active`}
              >
                <CursorOverlay />
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
            )
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

          {/* Chat panel — right overlay */}
          <AnimatePresence>
            {chatOpen && (
              <>
                {/* Mobile backdrop */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="fixed inset-0 bg-black/60 z-40 md:hidden"
                  onClick={() => setChatOpen(false)}
                />
                {/* Panel */}
                <motion.div
                  initial={{ x: "100%" }}
                  animate={{ x: 0 }}
                  exit={{ x: "100%" }}
                  transition={{ type: "spring", damping: 30, stiffness: 300 }}
                  className="fixed md:absolute top-0 right-0 bottom-0 w-full sm:w-80 md:w-96 z-50 md:z-20 bg-zinc-950 border-l border-zinc-800/30"
                >
                  {/* Close button — mobile */}
                  <div className="absolute top-2 right-2 z-10 md:hidden">
                    <button
                      onClick={() => setChatOpen(false)}
                      className="p-2 text-zinc-400 hover:text-zinc-200 transition-colors"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                  <ChatPanel
                    onImageClick={(src) => setLightboxSrc(src)}
                  />
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Image lightbox */}
      {lightboxSrc && (
        <ImageLightbox
          src={lightboxSrc}
          onClose={() => setLightboxSrc(null)}
        />
      )}
    </div>
  );
}

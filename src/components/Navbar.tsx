"use client";

import { Wifi, WifiOff, Menu, ChevronLeft, ChevronRight, TerminalIcon, FolderIcon, MessageCircle } from "@/components/Icons";

export type ViewMode = "terminal" | "files";

interface NavbarProps {
  activeSessionId: string | null;
  activeSessionName?: string | null;
  connectionStatus: "connected" | "disconnected" | "idle";
  sessionCount: { total: number; active: number };
  sidebarOpen?: boolean;
  onToggleSidebar?: () => void;
  onMenuClick?: () => void;
  viewMode?: ViewMode;
  onSwitchView?: (mode: ViewMode) => void;
  chatOpen?: boolean;
  onToggleChat?: () => void;
}

export default function Navbar({
  activeSessionId,
  activeSessionName,
  connectionStatus,
  sessionCount,
  sidebarOpen,
  onToggleSidebar,
  onMenuClick,
  viewMode,
  onSwitchView,
  chatOpen,
  onToggleChat,
}: NavbarProps) {
  return (
    <div className="h-14 border-b border-zinc-800/60 flex items-center justify-between px-3 md:px-5 bg-zinc-950/90 backdrop-blur-xl">
      <div className="flex items-center gap-2">
        {/* Sidebar toggle — desktop only */}
        {onToggleSidebar && (
          <button
            onClick={onToggleSidebar}
            className="hidden md:flex items-center justify-center w-7 h-7 rounded-md text-zinc-600 hover:text-zinc-400 hover:bg-zinc-800/80 transition-all cursor-pointer"
            title={sidebarOpen ? "Скрыть панель" : "Показать панель"}
          >
            {sidebarOpen ? (
              <ChevronLeft className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
          </button>
        )}

        {/* Hamburger — mobile only */}
        {onMenuClick && (
          <button
            onClick={onMenuClick}
            className="md:hidden p-2 -ml-1 text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}

        {activeSessionId && (
          <span className="text-sm text-zinc-500 font-mono truncate max-w-[150px] md:max-w-none">
            {activeSessionName || activeSessionId}
          </span>
        )}

        {/* View mode toggle */}
        {activeSessionId && viewMode && onSwitchView && (
          <div className="flex items-center gap-0.5 ml-2 bg-zinc-900/50 rounded-lg p-0.5 border border-zinc-800/50">
            <button
              onClick={() => onSwitchView("terminal")}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs transition-all cursor-pointer ${
                viewMode === "terminal"
                  ? "bg-violet-500/20 text-violet-300"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              <TerminalIcon className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Терминал</span>
            </button>
            <button
              onClick={() => onSwitchView("files")}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs transition-all cursor-pointer ${
                viewMode === "files"
                  ? "bg-violet-500/20 text-violet-300"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              <FolderIcon className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Файлы</span>
            </button>
          </div>
        )}
      </div>

      <div className="flex items-center gap-3">
        {/* Session counter */}
        <span className="text-xs text-zinc-600 hidden sm:inline">
          {sessionCount.total > 0
            ? `${sessionCount.total} сес. (${sessionCount.active} акт.)`
            : ""}
        </span>

        {/* Connection status */}
        {connectionStatus !== "idle" && (
          <div className="flex items-center gap-1.5">
            {connectionStatus === "connected" ? (
              <Wifi className="w-4 h-4 md:w-3.5 md:h-3.5 text-emerald-500" />
            ) : (
              <WifiOff className="w-4 h-4 md:w-3.5 md:h-3.5 text-zinc-500" />
            )}
          </div>
        )}

        {/* Chat toggle button */}
        {onToggleChat && (
          <button
            onClick={onToggleChat}
            className={`p-2 md:p-1.5 rounded-md transition-all cursor-pointer ${
              chatOpen
                ? "border border-violet-500/50 bg-violet-500/10 text-violet-400"
                : "text-zinc-500 hover:text-zinc-300 border border-transparent"
            }`}
            title="Чат"
          >
            <MessageCircle className="w-5 h-5 md:w-4 md:h-4" />
          </button>
        )}
      </div>
    </div>
  );
}

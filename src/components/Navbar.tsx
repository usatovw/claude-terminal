"use client";

import { useRouter } from "next/navigation";
import { Wifi, WifiOff, Menu, ChevronLeft, ChevronRight } from "@/components/Icons";

interface NavbarProps {
  activeSessionId: string | null;
  activeSessionName?: string | null;
  connectionStatus: "connected" | "disconnected" | "idle";
  sessionCount: { total: number; active: number };
  sidebarOpen?: boolean;
  onToggleSidebar?: () => void;
  onMenuClick?: () => void;
}

export default function Navbar({
  activeSessionId,
  activeSessionName,
  connectionStatus,
  sessionCount,
  sidebarOpen,
  onToggleSidebar,
  onMenuClick,
}: NavbarProps) {
  const router = useRouter();

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
  };

  return (
    <div className="h-14 border-b border-zinc-800/60 flex items-center justify-between px-3 md:px-5 bg-zinc-950/90 backdrop-blur-xl">
      <div className="flex items-center gap-2">
        {/* Sidebar toggle — desktop only */}
        {onToggleSidebar && (
          <button
            onClick={onToggleSidebar}
            className="hidden md:flex items-center justify-center w-7 h-7 rounded-md text-zinc-600 hover:text-zinc-400 hover:bg-zinc-800/80 transition-all"
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
      </div>

      <div className="flex items-center gap-4">
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

        <button
          onClick={handleLogout}
          className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors p-2 md:p-0"
        >
          Выйти
        </button>
      </div>
    </div>
  );
}

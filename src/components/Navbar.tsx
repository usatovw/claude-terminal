"use client";

import { useRouter } from "next/navigation";
import { Wifi, WifiOff } from "@/components/Icons";

interface NavbarProps {
  activeSessionId: string | null;
  connectionStatus: "connected" | "disconnected" | "idle";
  sessionCount: { total: number; active: number };
}

export default function Navbar({
  activeSessionId,
  connectionStatus,
  sessionCount,
}: NavbarProps) {
  const router = useRouter();

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
  };

  return (
    <div className="h-12 border-b border-zinc-800/50 flex items-center justify-between px-5 bg-zinc-950/80 backdrop-blur-md">
      <div className="flex items-center gap-3">
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-white font-bold text-xs">
          C
        </div>
        <span className="font-medium text-zinc-300 text-sm">Claude Terminal</span>
        {activeSessionId && (
          <>
            <span className="text-zinc-700">/</span>
            <span className="text-sm text-zinc-500 font-mono">
              {activeSessionId}
            </span>
          </>
        )}
      </div>

      <div className="flex items-center gap-4">
        {/* Session counter */}
        <span className="text-xs text-zinc-600">
          {sessionCount.total > 0
            ? `${sessionCount.total} сес. (${sessionCount.active} акт.)`
            : ""}
        </span>

        {/* Connection status */}
        {connectionStatus !== "idle" && (
          <div className="flex items-center gap-1.5">
            {connectionStatus === "connected" ? (
              <Wifi className="w-3.5 h-3.5 text-emerald-500" />
            ) : (
              <WifiOff className="w-3.5 h-3.5 text-zinc-500" />
            )}
          </div>
        )}

        <button
          onClick={handleLogout}
          className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
        >
          Выйти
        </button>
      </div>
    </div>
  );
}

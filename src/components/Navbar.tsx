"use client";

import { useRouter } from "next/navigation";

interface NavbarProps {
  activeSessionId: string | null;
}

export default function Navbar({ activeSessionId }: NavbarProps) {
  const router = useRouter();

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
  };

  return (
    <div className="h-14 border-b border-zinc-800 flex items-center justify-between px-6 bg-zinc-950/50 backdrop-blur-sm">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm">
          C
        </div>
        <span className="font-medium text-zinc-200">Claude Terminal</span>
        {activeSessionId && (
          <>
            <span className="text-zinc-700">/</span>
            <span className="text-sm text-zinc-400 font-mono">
              {activeSessionId}
            </span>
          </>
        )}
      </div>

      <button
        onClick={handleLogout}
        className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
      >
        Выйти
      </button>
    </div>
  );
}

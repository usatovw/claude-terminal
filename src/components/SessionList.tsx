"use client";

import { useState, useEffect, useCallback } from "react";

interface Session {
  sessionId: string;
  projectDir: string;
  createdAt: string;
  isActive: boolean;
  connectedClients: number;
}

interface SessionListProps {
  activeSessionId: string | null;
  onSelectSession: (sessionId: string) => void;
  onNewSession: () => void;
}

export default function SessionList({
  activeSessionId,
  onSelectSession,
  onNewSession,
}: SessionListProps) {
  const [sessions, setSessions] = useState<Session[]>([]);

  const fetchSessions = useCallback(async () => {
    try {
      const res = await fetch("/api/sessions");
      if (res.ok) {
        const data = await res.json();
        setSessions(data.sessions);
      }
    } catch {
      // Ignore fetch errors
    }
  }, []);

  useEffect(() => {
    fetchSessions();
    const interval = setInterval(fetchSessions, 5000);
    return () => clearInterval(interval);
  }, [fetchSessions]);

  const handleKill = async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await fetch(`/api/sessions/${sessionId}`, { method: "DELETE" });
    fetchSessions();
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleString("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-zinc-800">
        <button
          onClick={onNewSession}
          className="w-full px-4 py-3 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white rounded-xl font-medium transition-all duration-200 hover:shadow-lg hover:shadow-violet-500/25"
        >
          + Начать общение
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {sessions.length === 0 && (
          <p className="text-zinc-500 text-sm text-center py-8">
            Нет активных сессий
          </p>
        )}
        {sessions.map((session) => (
          <button
            key={session.sessionId}
            onClick={() => onSelectSession(session.sessionId)}
            className={`w-full text-left px-3 py-3 rounded-lg transition-all duration-150 group ${
              activeSessionId === session.sessionId
                ? "bg-zinc-800 border border-zinc-700"
                : "hover:bg-zinc-900 border border-transparent"
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className={`w-2 h-2 rounded-full flex-shrink-0 ${
                    session.isActive ? "bg-green-400" : "bg-zinc-600"
                  }`}
                />
                <span className="text-sm text-zinc-300 truncate">
                  {session.sessionId}
                </span>
              </div>
              {session.isActive && (
                <button
                  onClick={(e) => handleKill(session.sessionId, e)}
                  className="opacity-0 group-hover:opacity-100 text-zinc-500 hover:text-red-400 transition-all text-xs px-1"
                  title="Завершить сессию"
                >
                  ✕
                </button>
              )}
            </div>
            <div className="text-xs text-zinc-600 mt-1 pl-4">
              {formatDate(session.createdAt)}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

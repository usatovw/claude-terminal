"use client";

import { useState, useEffect, useCallback } from "react";

interface Session {
  sessionId: string;
  displayName: string | null;
  projectDir: string;
  createdAt: string;
  isActive: boolean;
  connectedClients: number;
}

interface SessionListProps {
  activeSessionId: string | null;
  onSelectSession: (sessionId: string) => void;
  onSessionDeleted: (sessionId: string) => void;
  onNewSession: () => void;
}

export default function SessionList({
  activeSessionId,
  onSelectSession,
  onSessionDeleted,
  onNewSession,
}: SessionListProps) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const fetchSessions = useCallback(async () => {
    try {
      const res = await fetch("/api/sessions");
      if (res.ok) {
        const data = await res.json();
        setSessions(data.sessions);
      }
    } catch {
      // Ignore
    }
  }, []);

  useEffect(() => {
    fetchSessions();
    const interval = setInterval(fetchSessions, 5000);
    return () => clearInterval(interval);
  }, [fetchSessions]);

  const handleDelete = async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Удалить сессию и все её данные?")) return;
    const res = await fetch(`/api/sessions/${sessionId}`, { method: "DELETE" });
    if (res.ok) {
      onSessionDeleted(sessionId);
      fetchSessions();
    }
  };

  const handleRenameStart = (session: Session, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(session.sessionId);
    setEditName(session.displayName || session.sessionId);
  };

  const handleRenameSubmit = async (sessionId: string) => {
    if (editName.trim()) {
      await fetch(`/api/sessions/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: editName.trim() }),
      });
      fetchSessions();
    }
    setEditingId(null);
  };

  const handleRenameKeyDown = (
    e: React.KeyboardEvent,
    sessionId: string
  ) => {
    if (e.key === "Enter") {
      handleRenameSubmit(sessionId);
    } else if (e.key === "Escape") {
      setEditingId(null);
    }
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
          <div
            key={session.sessionId}
            onClick={() => onSelectSession(session.sessionId)}
            className={`w-full text-left px-3 py-3 rounded-lg transition-all duration-150 group cursor-pointer ${
              activeSessionId === session.sessionId
                ? "bg-zinc-800 border border-zinc-700"
                : "hover:bg-zinc-900 border border-transparent"
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <span
                  className={`w-2 h-2 rounded-full flex-shrink-0 ${
                    session.isActive ? "bg-green-400" : "bg-zinc-600"
                  }`}
                />
                {editingId === session.sessionId ? (
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onBlur={() => handleRenameSubmit(session.sessionId)}
                    onKeyDown={(e) =>
                      handleRenameKeyDown(e, session.sessionId)
                    }
                    onClick={(e) => e.stopPropagation()}
                    className="text-sm text-zinc-300 bg-zinc-900 border border-zinc-600 rounded px-2 py-0.5 w-full outline-none focus:border-violet-500"
                    autoFocus
                  />
                ) : (
                  <span className="text-sm text-zinc-300 truncate">
                    {session.displayName || session.sessionId}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all flex-shrink-0 ml-1">
                <button
                  onClick={(e) => handleRenameStart(session, e)}
                  className="text-zinc-500 hover:text-zinc-300 text-xs px-1"
                  title="Переименовать"
                >
                  ✎
                </button>
                <button
                  onClick={(e) => handleDelete(session.sessionId, e)}
                  className="text-zinc-500 hover:text-red-400 text-xs px-1"
                  title="Удалить сессию и данные"
                >
                  🗑
                </button>
              </div>
            </div>
            <div className="text-xs text-zinc-600 mt-1 pl-4">
              {formatDate(session.createdAt)}
              {session.displayName && (
                <span className="ml-2 text-zinc-700">
                  {session.sessionId}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

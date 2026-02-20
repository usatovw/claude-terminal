"use client";

import { useState, useEffect, useCallback } from "react";
import { Pencil, Trash, Play, Pause } from "@/components/Icons";
import { HoverBorderGradient } from "@/components/ui/hover-border-gradient";

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

function relativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;

  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "только что";
  if (minutes < 60) return `${minutes} мин назад`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ч назад`;

  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} дн назад`;

  const months = Math.floor(days / 30);
  return `${months} мес назад`;
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

  const handleStop = async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await fetch(`/api/sessions/${sessionId}?action=stop`, { method: "DELETE" });
    fetchSessions();
  };

  const handleResume = async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await fetch(`/api/sessions/${sessionId}`, { method: "PUT" });
    fetchSessions();
    onSelectSession(sessionId);
  };

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

  const handleRenameKeyDown = (e: React.KeyboardEvent, sessionId: string) => {
    if (e.key === "Enter") handleRenameSubmit(sessionId);
    else if (e.key === "Escape") setEditingId(null);
  };

  const byNewest = (a: Session, b: Session) =>
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  const activeSessions = sessions.filter((s) => s.isActive).sort(byNewest);
  const stoppedSessions = sessions.filter((s) => !s.isActive).sort(byNewest);

  return (
    <div className="flex flex-col h-full">
      {/* New session button */}
      <div className="h-14 px-3 flex items-center border-b border-zinc-800/50">
        <HoverBorderGradient
          as="button"
          containerClassName="w-full"
          className="w-full flex items-center justify-center gap-2 bg-zinc-950 text-white px-4 py-2 text-sm font-medium"
          onClick={onNewSession}
        >
          Новый чат
        </HoverBorderGradient>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-4">
        {sessions.length === 0 && (
          <p className="text-zinc-600 text-sm text-center py-8">
            Нет сессий
          </p>
        )}

        {/* Active sessions */}
        {activeSessions.length > 0 && (
          <div>
            <div className="px-2 py-1.5 text-xs font-medium text-zinc-500 uppercase tracking-wider">
              Активные
            </div>
            {activeSessions.map((session) => (
              <SessionItem
                key={session.sessionId}
                session={session}
                isSelected={activeSessionId === session.sessionId}
                editingId={editingId}
                editName={editName}
                onSelect={() => onSelectSession(session.sessionId)}
                onStop={(e) => handleStop(session.sessionId, e)}
                onResume={(e) => handleResume(session.sessionId, e)}
                onDelete={(e) => handleDelete(session.sessionId, e)}
                onRenameStart={(e) => handleRenameStart(session, e)}
                onEditNameChange={setEditName}
                onRenameSubmit={() => handleRenameSubmit(session.sessionId)}
                onRenameKeyDown={(e) => handleRenameKeyDown(e, session.sessionId)}
              />
            ))}
          </div>
        )}

        {/* Stopped sessions */}
        {stoppedSessions.length > 0 && (
          <div>
            <div className="px-2 py-1.5 text-xs font-medium text-zinc-500 uppercase tracking-wider">
              Остановленные
            </div>
            {stoppedSessions.map((session) => (
              <SessionItem
                key={session.sessionId}
                session={session}
                isSelected={activeSessionId === session.sessionId}
                editingId={editingId}
                editName={editName}
                onSelect={() => onSelectSession(session.sessionId)}
                onStop={(e) => handleStop(session.sessionId, e)}
                onResume={(e) => handleResume(session.sessionId, e)}
                onDelete={(e) => handleDelete(session.sessionId, e)}
                onRenameStart={(e) => handleRenameStart(session, e)}
                onEditNameChange={setEditName}
                onRenameSubmit={() => handleRenameSubmit(session.sessionId)}
                onRenameKeyDown={(e) => handleRenameKeyDown(e, session.sessionId)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function SessionItem({
  session,
  isSelected,
  editingId,
  editName,
  onSelect,
  onStop,
  onResume,
  onDelete,
  onRenameStart,
  onEditNameChange,
  onRenameSubmit,
  onRenameKeyDown,
}: {
  session: Session;
  isSelected: boolean;
  editingId: string | null;
  editName: string;
  onSelect: () => void;
  onStop: (e: React.MouseEvent) => void;
  onResume: (e: React.MouseEvent) => void;
  onDelete: (e: React.MouseEvent) => void;
  onRenameStart: (e: React.MouseEvent) => void;
  onEditNameChange: (v: string) => void;
  onRenameSubmit: () => void;
  onRenameKeyDown: (e: React.KeyboardEvent) => void;
}) {
  const isEditing = editingId === session.sessionId;

  return (
    <div
      onClick={onSelect}
      className={`px-3 py-3 md:py-2.5 rounded-lg transition-all duration-150 group cursor-pointer ${
        isSelected
          ? "bg-gradient-to-r from-violet-500/10 to-indigo-500/10 border border-violet-500/20"
          : "hover:bg-zinc-800/50 border border-transparent"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span
            className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
              session.isActive
                ? "bg-emerald-400 shadow-sm shadow-emerald-400/50"
                : "bg-zinc-600"
            }`}
          />
          {isEditing ? (
            <input
              type="text"
              value={editName}
              onChange={(e) => onEditNameChange(e.target.value)}
              onBlur={onRenameSubmit}
              onKeyDown={onRenameKeyDown}
              onClick={(e) => e.stopPropagation()}
              className="text-sm text-zinc-200 bg-zinc-900 border border-zinc-600 rounded px-2 py-0.5 w-full outline-none focus:border-violet-500/50"
              autoFocus
            />
          ) : (
            <span className="text-sm text-zinc-300 truncate">
              {session.displayName || session.sessionId}
            </span>
          )}
        </div>

        {/* Action buttons — always visible on mobile, hover on desktop */}
        <div className="flex items-center gap-1 md:gap-0.5 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity flex-shrink-0">
          {session.isActive ? (
            <button
              onClick={onStop}
              className="p-2 md:p-1 text-zinc-500 hover:text-amber-400 transition-colors"
              title="Остановить"
            >
              <Pause className="w-4 h-4 md:w-3.5 md:h-3.5" />
            </button>
          ) : (
            <button
              onClick={onResume}
              className="p-2 md:p-1 text-zinc-500 hover:text-emerald-400 transition-colors"
              title="Возобновить"
            >
              <Play className="w-4 h-4 md:w-3.5 md:h-3.5" />
            </button>
          )}
          <button
            onClick={onRenameStart}
            className="p-2 md:p-1 text-zinc-500 hover:text-zinc-300 transition-colors"
            title="Переименовать"
          >
            <Pencil className="w-4 h-4 md:w-3.5 md:h-3.5" />
          </button>
          <button
            onClick={onDelete}
            className="p-2 md:p-1 text-zinc-500 hover:text-red-400 transition-colors"
            title="Удалить"
          >
            <Trash className="w-4 h-4 md:w-3.5 md:h-3.5" />
          </button>
        </div>
      </div>

      <div className="text-xs text-zinc-600 mt-1 pl-4 flex items-center gap-2">
        <span>{relativeTime(session.createdAt)}</span>
        {session.displayName && (
          <span className="text-zinc-700">{session.sessionId}</span>
        )}
      </div>
    </div>
  );
}

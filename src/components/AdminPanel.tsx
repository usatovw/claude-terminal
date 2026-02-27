"use client";

import { useState, useEffect, useCallback } from "react";
import { PRESENCE_COLORS } from "@/lib/presence-colors";

interface AdminUser {
  id: number;
  login: string;
  firstName: string;
  lastName: string;
  role: "admin" | "user" | "guest";
  status: "pending" | "approved" | "rejected";
  colorIndex: number;
  createdAt: string;
}

interface AdminPanelProps {
  onPendingCountChange?: (count: number) => void;
}

export default function AdminPanel({ onPendingCountChange }: AdminPanelProps) {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/users");
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users);
        const pendingCount = data.users.filter((u: AdminUser) => u.status === "pending").length;
        onPendingCountChange?.(pendingCount);
      }
    } catch {
      // Ignore
    } finally {
      setLoading(false);
    }
  }, [onPendingCountChange]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleAction = useCallback(async (userId: number, action: string, role?: string) => {
    setActionLoading(userId);
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, action, role }),
      });
      if (res.ok) {
        await fetchUsers();
      } else {
        const data = await res.json();
        alert(data.error || "Ошибка");
      }
    } catch {
      alert("Ошибка сети");
    } finally {
      setActionLoading(null);
    }
  }, [fetchUsers]);

  const handleDelete = useCallback(async (userId: number) => {
    setActionLoading(userId);
    try {
      const res = await fetch(`/api/admin/users/${userId}`, { method: "DELETE" });
      if (res.ok) {
        setDeleteConfirm(null);
        await fetchUsers();
      } else {
        const data = await res.json();
        alert(data.error || "Ошибка");
      }
    } catch {
      alert("Ошибка сети");
    } finally {
      setActionLoading(null);
    }
  }, [fetchUsers]);

  const pendingUsers = users.filter((u) => u.status === "pending");
  const approvedUsers = users.filter((u) => u.status === "approved");
  const rejectedUsers = users.filter((u) => u.status === "rejected");

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="h-12 flex items-center px-4 border-b border-border flex-shrink-0">
        <span className="text-sm font-medium text-foreground">Пользователи</span>
        <span className="ml-2 text-xs text-muted-fg">{users.length}</span>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin h-6 w-6 border-2 border-accent border-t-transparent rounded-full" />
          </div>
        ) : (
          <div className="py-2">
            {/* Pending section */}
            {pendingUsers.length > 0 && (
              <div className="mb-4">
                <div className="px-4 py-1.5">
                  <span className="text-xs font-medium text-amber-400 uppercase tracking-wider">
                    Ожидают подтверждения ({pendingUsers.length})
                  </span>
                </div>
                {pendingUsers.map((user) => (
                  <UserRow
                    key={user.id}
                    user={user}
                    actionLoading={actionLoading === user.id}
                    onApprove={() => handleAction(user.id, "approve")}
                    onReject={() => handleAction(user.id, "reject")}
                  />
                ))}
              </div>
            )}

            {/* Approved section */}
            {approvedUsers.length > 0 && (
              <div className="mb-4">
                <div className="px-4 py-1.5">
                  <span className="text-xs font-medium text-muted-fg uppercase tracking-wider">
                    Активные ({approvedUsers.length})
                  </span>
                </div>
                {approvedUsers.map((user) => (
                  <UserRow
                    key={user.id}
                    user={user}
                    actionLoading={actionLoading === user.id}
                    deleteConfirm={deleteConfirm === user.id}
                    onSetRole={(role) => handleAction(user.id, "set_role", role)}
                    onDeleteClick={() => setDeleteConfirm(user.id)}
                    onDeleteConfirm={() => handleDelete(user.id)}
                    onDeleteCancel={() => setDeleteConfirm(null)}
                  />
                ))}
              </div>
            )}

            {/* Rejected section */}
            {rejectedUsers.length > 0 && (
              <div className="mb-4">
                <div className="px-4 py-1.5">
                  <span className="text-xs font-medium text-red-400 uppercase tracking-wider">
                    Отклонённые ({rejectedUsers.length})
                  </span>
                </div>
                {rejectedUsers.map((user) => (
                  <UserRow
                    key={user.id}
                    user={user}
                    actionLoading={actionLoading === user.id}
                    onApprove={() => handleAction(user.id, "approve")}
                    deleteConfirm={deleteConfirm === user.id}
                    onDeleteClick={() => setDeleteConfirm(user.id)}
                    onDeleteConfirm={() => handleDelete(user.id)}
                    onDeleteCancel={() => setDeleteConfirm(null)}
                  />
                ))}
              </div>
            )}

            {users.length === 0 && (
              <div className="flex items-center justify-center h-40">
                <p className="text-muted text-sm">Нет пользователей</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function UserRow({
  user,
  actionLoading,
  deleteConfirm,
  onApprove,
  onReject,
  onSetRole,
  onDeleteClick,
  onDeleteConfirm,
  onDeleteCancel,
}: {
  user: AdminUser;
  actionLoading: boolean;
  deleteConfirm?: boolean;
  onApprove?: () => void;
  onReject?: () => void;
  onSetRole?: (role: string) => void;
  onDeleteClick?: () => void;
  onDeleteConfirm?: () => void;
  onDeleteCancel?: () => void;
}) {
  const color = PRESENCE_COLORS[user.colorIndex % PRESENCE_COLORS.length];
  const initial = (user.firstName || user.login)[0].toUpperCase();
  const name = [user.firstName, user.lastName].filter(Boolean).join(" ");

  return (
    <div className="px-4 py-2.5 hover:bg-surface-hover transition-colors">
      <div className="flex items-center gap-3">
        {/* Avatar */}
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-medium flex-shrink-0"
          style={{ backgroundColor: color.cursor }}
        >
          {initial}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm text-foreground font-medium truncate">{name}</span>
            {/* Role badge */}
            <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
              user.role === "admin"
                ? "bg-violet-500/20 text-violet-400"
                : "bg-zinc-500/20 text-zinc-400"
            }`}>
              {user.role}
            </span>
          </div>
          <span className="text-xs text-muted-fg">{user.login}</span>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {actionLoading ? (
            <div className="animate-spin h-4 w-4 border-2 border-muted border-t-muted-fg rounded-full" />
          ) : (
            <>
              {/* Pending: approve/reject */}
              {user.status === "pending" && (
                <>
                  {onApprove && (
                    <button
                      onClick={onApprove}
                      className="px-2.5 py-1 text-xs bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 rounded transition-colors cursor-pointer"
                    >
                      Принять
                    </button>
                  )}
                  {onReject && (
                    <button
                      onClick={onReject}
                      className="px-2.5 py-1 text-xs bg-red-500/20 text-red-400 hover:bg-red-500/30 rounded transition-colors cursor-pointer"
                    >
                      Отклонить
                    </button>
                  )}
                </>
              )}

              {/* Approved: role toggle + delete */}
              {user.status === "approved" && onSetRole && (
                <select
                  value={user.role}
                  onChange={(e) => onSetRole(e.target.value)}
                  className="text-xs bg-surface-alt text-foreground border border-border rounded px-1.5 py-1 cursor-pointer outline-none focus:border-accent"
                >
                  <option value="user">user</option>
                  <option value="admin">admin</option>
                </select>
              )}

              {/* Rejected: approve back */}
              {user.status === "rejected" && onApprove && (
                <button
                  onClick={onApprove}
                  className="px-2.5 py-1 text-xs bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 rounded transition-colors cursor-pointer"
                >
                  Принять
                </button>
              )}

              {/* Delete */}
              {(user.status === "approved" || user.status === "rejected") && onDeleteClick && (
                deleteConfirm ? (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={onDeleteConfirm}
                      className="px-2 py-1 text-xs bg-red-500/20 text-red-400 hover:bg-red-500/30 rounded transition-colors cursor-pointer"
                    >
                      Да
                    </button>
                    <button
                      onClick={onDeleteCancel}
                      className="px-2 py-1 text-xs bg-zinc-500/20 text-zinc-400 hover:bg-zinc-500/30 rounded transition-colors cursor-pointer"
                    >
                      Нет
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={onDeleteClick}
                    className="p-1 text-muted-fg hover:text-red-400 transition-colors cursor-pointer"
                    title="Удалить"
                  >
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 6h18" />
                      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                    </svg>
                  </button>
                )
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

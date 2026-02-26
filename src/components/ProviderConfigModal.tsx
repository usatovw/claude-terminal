"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import ModalTitleBar from "@/components/ModalTitleBar";
import type { Provider } from "@/lib/ProviderContext";

interface ProviderConfigModalProps {
  open: boolean;
  provider: Provider | null;
  onClose: () => void;
  onSave: (slug: string, data: { name?: string; command?: string; resumeCommand?: string }) => Promise<void>;
  onDelete: (slug: string) => Promise<void>;
}

export default function ProviderConfigModal({
  open,
  provider,
  onClose,
  onSave,
  onDelete,
}: ProviderConfigModalProps) {
  const [name, setName] = useState("");
  const [command, setCommand] = useState("");
  const [resumeCommand, setResumeCommand] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (provider && open) {
      setName(provider.name);
      setCommand(provider.command);
      setResumeCommand(provider.resume_command || "");
      setError("");
      setSaving(false);
      setDeleting(false);
    }
  }, [provider, open]);

  const handleSave = useCallback(async () => {
    if (!provider) return;
    if (!name.trim() || !command.trim()) {
      setError("Название и команда обязательны");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await onSave(provider.slug, {
        name: name.trim(),
        command: command.trim(),
        resumeCommand: resumeCommand.trim() || undefined,
      });
      onClose();
    } catch (err) {
      setError((err as Error).message || "Ошибка сохранения");
    } finally {
      setSaving(false);
    }
  }, [provider, name, command, resumeCommand, onSave, onClose]);

  const handleDelete = useCallback(async () => {
    if (!provider) return;
    setDeleting(true);
    setError("");
    try {
      await onDelete(provider.slug);
      onClose();
    } catch (err) {
      setError((err as Error).message || "Ошибка удаления");
    } finally {
      setDeleting(false);
    }
  }, [provider, onDelete, onClose]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  const isBuiltin = !!provider?.is_builtin;

  return (
    <AnimatePresence>
      {open && provider && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="bg-surface border border-border-strong rounded-[var(--th-radius)] overflow-hidden w-full max-w-md flex flex-col"
            style={{ boxShadow: "var(--th-shadow, 0 0 0 transparent), 0 25px 50px -12px rgba(0,0,0,0.5)" }}
          >
            <ModalTitleBar title={`Настройки: ${provider.name}`} onClose={onClose} />

            <div className="p-4 space-y-4">
              {isBuiltin && (
                <div className="px-3 py-2 rounded-lg bg-surface-hover border border-border text-xs text-muted-fg">
                  Встроенный провайдер — изменения могут повлиять на работу системы
                </div>
              )}

              <div>
                <label className="block text-xs text-muted-fg mb-1.5">Название</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-surface-alt text-foreground outline-none focus:border-accent"
                />
              </div>

              <div>
                <label className="block text-xs text-muted-fg mb-1.5">Команда запуска</label>
                <input
                  value={command}
                  onChange={(e) => setCommand(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-surface-alt text-foreground font-mono outline-none focus:border-accent"
                />
              </div>

              <div>
                <label className="block text-xs text-muted-fg mb-1.5">Команда resume</label>
                <input
                  value={resumeCommand}
                  onChange={(e) => setResumeCommand(e.target.value)}
                  placeholder="Опционально"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-surface-alt text-foreground font-mono outline-none focus:border-accent"
                />
              </div>

              {error && <p className="text-xs text-danger">{error}</p>}
            </div>

            <div className="border-t border-border px-4 py-3 flex items-center justify-between shrink-0">
              {!isBuiltin ? (
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="text-sm text-danger hover:text-danger/80 transition-colors cursor-pointer disabled:opacity-50"
                >
                  {deleting ? "Удаление..." : "Удалить"}
                </button>
              ) : (
                <div />
              )}
              <button
                onClick={handleSave}
                disabled={saving || !name.trim() || !command.trim()}
                className="px-4 py-1.5 text-sm rounded-lg bg-accent text-white font-medium hover:brightness-110 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? "Сохранение..." : "Сохранить"}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

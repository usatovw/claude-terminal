"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { HoverBorderGradient } from "@/components/ui/hover-border-gradient";
import ModalTitleBar from "@/components/ModalTitleBar";

interface NewFileModalProps {
  open: boolean;
  sessionId: string;
  currentPath: string;
  onClose: () => void;
  onCreated: (relativePath: string, name: string, type: "file" | "folder") => void;
}

export default function NewFileModal({
  open,
  sessionId,
  currentPath,
  onClose,
  onCreated,
}: NewFileModalProps) {
  const [type, setType] = useState<"file" | "folder">("file");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setName("");
      setError(null);
      setType("file");
    }
  }, [open]);

  const handleCreate = useCallback(async () => {
    if (!name.trim()) {
      setError(type === "folder" ? "Укажите имя папки" : "Укажите имя файла");
      return;
    }
    setError(null);
    setCreating(true);

    try {
      const res = await fetch(`/api/sessions/${sessionId}/files/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), directory: currentPath, type }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Ошибка создания");
      }

      const data = await res.json();
      onCreated(data.path, name.trim(), type);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка создания");
    } finally {
      setCreating(false);
    }
  }, [name, type, sessionId, currentPath, onCreated, onClose]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && name.trim() && !creating) {
        handleCreate();
      }
      if (e.key === "Escape") {
        onClose();
      }
    },
    [handleCreate, name, creating, onClose]
  );

  return (
    <AnimatePresence>
      {open && (
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
            onAnimationComplete={() => inputRef.current?.focus()}
            onClick={(e) => e.stopPropagation()}
            className="bg-surface border border-border-strong rounded-[var(--th-radius)] overflow-hidden max-w-sm w-full"
            style={{
              boxShadow: "var(--th-shadow, 0 0 0 transparent), 0 25px 50px -12px rgba(0,0,0,0.5)",
            }}
          >
            <ModalTitleBar title="Создать" onClose={onClose} />

            <div className="p-4 space-y-4">
              {/* Type selector */}
              <div className="flex gap-2">
                <button
                  onClick={() => setType("file")}
                  className={`flex-1 py-2 text-xs rounded-lg border transition-colors cursor-pointer ${
                    type === "file"
                      ? "bg-accent/20 border-accent/40 text-accent-fg"
                      : "border-border text-muted-fg hover:text-foreground"
                  }`}
                >
                  Файл
                </button>
                <button
                  onClick={() => setType("folder")}
                  className={`flex-1 py-2 text-xs rounded-lg border transition-colors cursor-pointer ${
                    type === "folder"
                      ? "bg-accent/20 border-accent/40 text-accent-fg"
                      : "border-border text-muted-fg hover:text-foreground"
                  }`}
                >
                  Папка
                </button>
              </div>

              {/* Name input */}
              <input
                ref={inputRef}
                type="text"
                value={name}
                onChange={(e) => { setName(e.target.value); setError(null); }}
                onKeyDown={handleKeyDown}
                placeholder={type === "file" ? "имя-файла.ts" : "имя-папки"}
                className="w-full px-3 py-2 text-sm bg-surface-alt border border-border-strong rounded-lg text-foreground placeholder-muted outline-none focus:border-accent/40 transition-colors"
              />

              {/* Error */}
              {error && (
                <p className="text-xs text-danger">{error}</p>
              )}

              {/* Actions */}
              <div className="flex items-center justify-end gap-2">
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-xs text-muted-fg hover:text-foreground transition-colors cursor-pointer"
                >
                  Отмена
                </button>
                <HoverBorderGradient
                  as="button"
                  containerClassName=""
                  className="bg-accent/20 text-accent-fg px-4 py-1.5 text-xs font-medium"
                  onClick={handleCreate}
                >
                  {creating ? "Создание..." : "Создать"}
                </HoverBorderGradient>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

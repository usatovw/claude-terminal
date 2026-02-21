"use client";

import { motion, AnimatePresence } from "motion/react";
import { HoverBorderGradient } from "@/components/ui/hover-border-gradient";

interface DeleteConfirmModalProps {
  paths: string[] | null;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function DeleteConfirmModal({
  paths,
  onConfirm,
  onCancel,
}: DeleteConfirmModalProps) {
  return (
    <AnimatePresence>
      {paths && paths.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
          onClick={onCancel}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-surface-alt border border-border-strong rounded-xl p-5 max-w-sm w-full shadow-2xl"
          >
            <h3 className="text-sm font-medium text-foreground mb-3">
              Удалить {paths.length === 1 ? "файл" : `файлов: ${paths.length}`}?
            </h3>

            <div className="max-h-40 overflow-y-auto mb-4 space-y-1">
              {paths.map((p) => (
                <div key={p} className="text-xs text-muted-fg font-mono truncate px-2 py-1 bg-surface-hover/50 rounded">
                  {p}
                </div>
              ))}
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                onClick={onCancel}
                className="px-4 py-2 text-xs text-muted-fg hover:text-foreground transition-colors cursor-pointer"
              >
                Отмена
              </button>
              <HoverBorderGradient
                as="button"
                containerClassName=""
                className="bg-danger/20 text-danger px-4 py-1.5 text-xs font-medium"
                onClick={onConfirm}
              >
                Удалить
              </HoverBorderGradient>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

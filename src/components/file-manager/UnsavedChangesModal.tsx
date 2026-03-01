"use client";

import { motion, AnimatePresence } from "motion/react";
import { HoverBorderGradient } from "@/components/ui/hover-border-gradient";

interface UnsavedChangesModalProps {
  open: boolean;
  fileName?: string;
  onSave: () => void;
  onDiscard: () => void;
  onCancel: () => void;
}

export default function UnsavedChangesModal({
  open,
  fileName,
  onSave,
  onDiscard,
  onCancel,
}: UnsavedChangesModalProps) {
  return (
    <AnimatePresence>
      {open && (
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
            <h3 className="text-sm font-medium text-foreground mb-2">
              Несохранённые изменения
            </h3>
            <p className="text-xs text-muted-fg mb-4">
              {fileName
                ? `Файл "${fileName}" содержит несохранённые изменения.`
                : "Есть несохранённые изменения."}
            </p>

            <div className="flex items-center justify-end gap-2">
              <button
                onClick={onCancel}
                className="px-4 py-2 text-xs text-muted-fg hover:text-foreground transition-colors cursor-pointer"
              >
                Отмена
              </button>
              <button
                onClick={onDiscard}
                className="px-4 py-2 text-xs text-danger hover:text-danger/80 transition-colors cursor-pointer"
              >
                Не сохранять
              </button>
              <HoverBorderGradient
                as="button"
                containerClassName=""
                className="bg-accent/20 text-accent-fg px-4 py-1.5 text-xs font-medium"
                onClick={onSave}
              >
                Сохранить
              </HoverBorderGradient>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { HoverBorderGradient } from "@/components/ui/hover-border-gradient";
import { CheckSquare, Square } from "@/components/Icons";

interface SessionDeleteModalProps {
  session: { sessionId: string; displayName: string | null } | null;
  hasFiles: boolean;
  onConfirm: (deleteFiles: boolean) => void;
  onCancel: () => void;
}

export default function SessionDeleteModal({
  session,
  hasFiles,
  onConfirm,
  onCancel,
}: SessionDeleteModalProps) {
  const [deleteFiles, setDeleteFiles] = useState(true);

  // Reset checkbox when modal opens
  useEffect(() => {
    if (session) setDeleteFiles(true);
  }, [session]);

  return (
    <AnimatePresence>
      {session && (
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
            className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 max-w-sm w-full shadow-2xl"
          >
            <h3 className="text-sm font-medium text-zinc-200 mb-2">
              Удалить сессию?
            </h3>

            <p className="text-xs text-zinc-400 mb-4">
              {session.displayName || session.sessionId}
            </p>

            {hasFiles && (
              <label
                className="flex items-center gap-2 mb-4 cursor-pointer group"
                onClick={() => setDeleteFiles((v) => !v)}
              >
                {deleteFiles ? (
                  <CheckSquare className="w-4 h-4 text-red-400" />
                ) : (
                  <Square className="w-4 h-4 text-zinc-500 group-hover:text-zinc-300 transition-colors" />
                )}
                <span className="text-xs text-zinc-300">
                  Также удалить все файлы сессии
                </span>
              </label>
            )}

            <div className="flex items-center justify-end gap-2">
              <button
                onClick={onCancel}
                className="px-4 py-2 text-xs text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
              >
                Отмена
              </button>
              <HoverBorderGradient
                as="button"
                containerClassName=""
                className="bg-red-950 text-red-300 px-4 py-1.5 text-xs font-medium"
                onClick={() => onConfirm(hasFiles ? deleteFiles : true)}
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

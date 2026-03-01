"use client";

import { useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useOS, type OS } from "@/lib/useOS";
import ModalTitleBar from "@/components/ModalTitleBar";

// ─── Data ────────────────────────────────────────────────────────────────────

interface Hotkey {
  description: string;
  mac: string[];
  win: string[];
  note?: string;
}

interface HotkeyGroup {
  title: string;
  hotkeys: Hotkey[];
}

const HOTKEY_GROUPS: HotkeyGroup[] = [
  {
    title: "Терминал",
    hotkeys: [
      {
        description: "Копировать",
        mac: ["⌘", "C"],
        win: ["Ctrl", "C"],
        note: "Win/Linux: при выделенном тексте",
      },
      {
        description: "Копировать (альтернатива)",
        mac: ["⌘", "C"],
        win: ["Ctrl", "Shift", "C"],
      },
      {
        description: "Вставить",
        mac: ["⌘", "V"],
        win: ["Ctrl", "V"],
      },
      {
        description: "Вставить (альтернатива)",
        mac: ["⌘", "V"],
        win: ["Ctrl", "Shift", "V"],
      },
      {
        description: "Прервать процесс (SIGINT)",
        mac: ["⌃", "C"],
        win: ["Ctrl", "C"],
        note: "Win/Linux: без выделения",
      },
      {
        description: "Очистить экран",
        mac: ["⌘", "K"],
        win: ["Ctrl", "L"],
      },
    ],
  },
  {
    title: "Навигация",
    hotkeys: [
      {
        description: "Прокрутка вверх",
        mac: ["⇧", "Page Up"],
        win: ["Shift", "Page Up"],
      },
      {
        description: "Прокрутка вниз",
        mac: ["⇧", "Page Down"],
        win: ["Shift", "Page Down"],
      },
      {
        description: "В начало буфера",
        mac: ["⌘", "Home"],
        win: ["Ctrl", "Home"],
      },
      {
        description: "В конец буфера",
        mac: ["⌘", "End"],
        win: ["Ctrl", "End"],
      },
    ],
  },
  {
    title: "Интерфейс",
    hotkeys: [
      {
        description: "Выход из полноэкранного режима",
        mac: ["Esc"],
        win: ["Esc"],
      },
    ],
  },
  {
    title: "Редактор",
    hotkeys: [
      {
        description: "Сохранить файл",
        mac: ["⌘", "S"],
        win: ["Ctrl", "S"],
      },
      {
        description: "Закрыть вкладку",
        mac: ["⌥", "W"],
        win: ["Alt", "W"],
      },
      {
        description: "Превью (toggle)",
        mac: ["⌘", "⇧", "V"],
        win: ["Ctrl", "Shift", "V"],
      },
      {
        description: "Поиск в файле",
        mac: ["⌘", "F"],
        win: ["Ctrl", "F"],
      },
      {
        description: "Замена в файле",
        mac: ["⌘", "H"],
        win: ["Ctrl", "H"],
      },
      {
        description: "Отменить",
        mac: ["⌘", "Z"],
        win: ["Ctrl", "Z"],
      },
      {
        description: "Повторить",
        mac: ["⌘", "⇧", "Z"],
        win: ["Ctrl", "Shift", "Z"],
      },
    ],
  },
  {
    title: "Чат",
    hotkeys: [
      {
        description: "Отправить сообщение",
        mac: ["Enter"],
        win: ["Enter"],
      },
      {
        description: "Новая строка в сообщении",
        mac: ["⇧", "Enter"],
        win: ["Shift", "Enter"],
      },
      {
        description: "Открыть чат курсора",
        mac: ["/"],
        win: ["/"],
      },
    ],
  },
];

// ─── Sub-components ──────────────────────────────────────────────────────────

function KeyCap({ children }: { children: string }) {
  return (
    <kbd className="inline-flex items-center justify-center min-w-[28px] h-[26px] px-1.5 rounded-[6px] text-[11px] font-mono font-medium bg-surface-hover border border-border text-foreground/70 shadow-[0_1px_0_1px_var(--th-border)]">
      {children}
    </kbd>
  );
}

function KeyCombo({ keys }: { keys: string[] }) {
  return (
    <div className="flex items-center gap-[3px]">
      {keys.map((key, i) => (
        <KeyCap key={i}>{key}</KeyCap>
      ))}
    </div>
  );
}

function HotkeyRow({ hotkey, os }: { hotkey: Hotkey; os: OS }) {
  const keys = os === "mac" ? hotkey.mac : hotkey.win;

  return (
    <div className="flex items-center justify-between py-2 px-4 gap-4">
      <div className="flex flex-col min-w-0">
        <span className="text-xs text-foreground truncate">
          {hotkey.description}
        </span>
        {hotkey.note && (
          <span className="text-[10px] text-muted-fg mt-0.5">
            {hotkey.note}
          </span>
        )}
      </div>
      <KeyCombo keys={keys} />
    </div>
  );
}

// ─── Main modal ──────────────────────────────────────────────────────────────

interface HotkeysModalProps {
  open: boolean;
  onClose: () => void;
}

export default function HotkeysModal({ open, onClose }: HotkeysModalProps) {
  const os = useOS();

  const handleEscape = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose]
  );

  useEffect(() => {
    if (!open) return;
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [open, handleEscape]);

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
            onClick={(e) => e.stopPropagation()}
            className="bg-surface border border-border-strong rounded-[var(--th-radius)] overflow-hidden max-w-md w-full max-h-[80vh] flex flex-col"
            style={{
              boxShadow:
                "var(--th-shadow, 0 0 0 transparent), 0 25px 50px -12px rgba(0,0,0,0.5)",
            }}
          >
            {/* Title bar */}
            <ModalTitleBar title="Горячие клавиши" onClose={onClose} />

            {/* Content */}
            <div className="flex-1 overflow-y-auto py-2">
              {HOTKEY_GROUPS.map((group, gi) => (
                <div key={gi}>
                  {gi > 0 && (
                    <div className="h-px bg-border mx-4 my-1" />
                  )}
                  <div className="px-4 pt-3 pb-1">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-fg">
                      {group.title}
                    </span>
                  </div>
                  {group.hotkeys.map((hk, hi) => (
                    <HotkeyRow key={hi} hotkey={hk} os={os} />
                  ))}
                </div>
              ))}
            </div>

            {/* Footer hint */}
            <div className="border-t border-border px-4 py-2.5 text-center shrink-0">
              <span className="text-[10px] text-muted">
                {os === "mac" ? "macOS" : os === "windows" ? "Windows" : "Linux"}{" "}
                — раскладка определена автоматически
              </span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

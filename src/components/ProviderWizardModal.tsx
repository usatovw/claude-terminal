"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import dynamic from "next/dynamic";
import ModalTitleBar from "@/components/ModalTitleBar";
import { getProviderIcon } from "@/lib/provider-icons";
import { PROVIDER_PRESETS, type ProviderPreset } from "@/lib/provider-presets";
import { ArrowLeft, TerminalIcon, ChevronDown, ChevronUp } from "@/components/Icons";
import { useTheme } from "@/lib/ThemeContext";

const EphemeralTerminal = dynamic(() => import("@/components/EphemeralTerminal"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[200px] rounded-lg border border-border flex items-center justify-center bg-surface-alt">
      <div className="animate-spin h-5 w-5 border-2 border-accent border-t-transparent rounded-full" />
    </div>
  ),
});

interface ProviderWizardModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: {
    name: string;
    slug: string;
    command: string;
    resumeCommand: string;
    icon: string;
    color: string;
  }) => Promise<void>;
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 30);
}

export default function ProviderWizardModal({ open, onClose, onSave }: ProviderWizardModalProps) {
  const { theme } = useTheme();
  const isRetro = theme === "retro";

  const [step, setStep] = useState<1 | 2>(1);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [command, setCommand] = useState("");
  const [resumeCommand, setResumeCommand] = useState("");
  const [icon, setIcon] = useState("default");
  const [color, setColor] = useState("#8b5cf6");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [slugManual, setSlugManual] = useState(false);
  const [installHint, setInstallHint] = useState("");

  // Terminal section
  const [terminalOpen, setTerminalOpen] = useState(false);
  const [ephemeralId, setEphemeralId] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState(300);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [copied, setCopied] = useState(false);

  // Reset on open
  useEffect(() => {
    if (open) {
      setStep(1);
      setName("");
      setSlug("");
      setCommand("");
      setResumeCommand("");
      setIcon("default");
      setColor("#8b5cf6");
      setSaving(false);
      setError("");
      setSlugManual(false);
      setInstallHint("");
      setTerminalOpen(false);
      setEphemeralId(null);
      setTimeLeft(300);
      setCopied(false);
    }
  }, [open]);

  // Cleanup ephemeral session on modal close
  useEffect(() => {
    if (!open && ephemeralId) {
      fetch("/api/ephemeral", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: ephemeralId }),
      }).catch(() => {});
      setEphemeralId(null);
    }
  }, [open, ephemeralId]);

  // Auto-slug from name
  useEffect(() => {
    if (!slugManual && name) {
      setSlug(slugify(name));
    }
  }, [name, slugManual]);

  // Timer — runs only when terminal is open
  useEffect(() => {
    if (terminalOpen && ephemeralId) {
      timerRef.current = setInterval(() => {
        setTimeLeft((t) => {
          if (t <= 1) {
            if (timerRef.current) clearInterval(timerRef.current);
            return 0;
          }
          return t - 1;
        });
      }, 1000);
      return () => {
        if (timerRef.current) clearInterval(timerRef.current);
      };
    }
  }, [terminalOpen, ephemeralId]);

  const handlePresetSelect = useCallback((preset: ProviderPreset) => {
    setName(preset.name);
    setSlug(preset.slug);
    setCommand(preset.command);
    setResumeCommand(preset.resumeCommand || "");
    setIcon(preset.icon);
    setColor(preset.color);
    setInstallHint(preset.installHint);
    setSlugManual(true);
    setStep(2);
  }, []);

  const handleCustom = useCallback(() => {
    setName("");
    setSlug("");
    setCommand("");
    setResumeCommand("");
    setIcon("default");
    setColor("#8b5cf6");
    setInstallHint("");
    setSlugManual(false);
    setStep(2);
  }, []);

  const handleToggleTerminal = useCallback(async () => {
    if (terminalOpen) {
      setTerminalOpen(false);
      return;
    }

    // Lazy create ephemeral session on first open
    if (!ephemeralId) {
      try {
        const res = await fetch("/api/ephemeral", { method: "POST" });
        if (!res.ok) {
          const data = await res.json();
          setError(data.error || "Ошибка создания терминала");
          return;
        }
        const data = await res.json();
        setEphemeralId(data.sessionId);
        setTimeLeft(300);
      } catch {
        setError("Ошибка сети");
        return;
      }
    }

    setTerminalOpen(true);
  }, [terminalOpen, ephemeralId]);

  const handleCopyHint = useCallback(async () => {
    if (!installHint) return;
    try {
      await navigator.clipboard.writeText(installHint);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* ignore */ }
  }, [installHint]);

  const handleSave = useCallback(async () => {
    if (!name.trim() || !slug.trim() || !command.trim()) {
      setError("Заполните обязательные поля");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await onSave({ name: name.trim(), slug: slug.trim(), command: command.trim(), resumeCommand: resumeCommand.trim(), icon, color });
      onClose();
    } catch (err) {
      setError((err as Error).message || "Ошибка сохранения");
    } finally {
      setSaving(false);
    }
  }, [name, slug, command, resumeCommand, icon, color, onSave, onClose]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  const terminalContent = (
    <div className="space-y-2">
      {/* Install hint or custom warning */}
      {installHint ? (
        <button
          onClick={handleCopyHint}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-surface-alt border border-border text-left cursor-pointer hover:border-accent transition-colors group"
        >
          <span className="text-xs text-muted-fg whitespace-nowrap">Установите:</span>
          <code className="text-xs font-mono text-accent flex-1 truncate">{installHint}</code>
          <span className="text-[10px] text-muted-fg opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
            {copied ? "Скопировано!" : "Копировать"}
          </span>
        </button>
      ) : (
        <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-[#f59e0b15] border border-[#f59e0b40] text-xs text-[#f59e0b]">
          <span className="shrink-0 mt-0.5">⚠</span>
          <span>Убедитесь, что CLI-пакет установлен на сервере перед использованием</span>
        </div>
      )}

      {/* Terminal */}
      {ephemeralId && <EphemeralTerminal ephemeralId={ephemeralId} />}

      {timeLeft === 0 && (
        <p className="text-xs text-danger">Время истекло. Закройте терминал и раскройте снова.</p>
      )}
    </div>
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
            onClick={(e) => e.stopPropagation()}
            className="bg-surface border border-border-strong rounded-[var(--th-radius)] overflow-hidden w-full max-w-lg max-h-[85vh] flex flex-col"
            style={{ boxShadow: "var(--th-shadow, 0 0 0 transparent), 0 25px 50px -12px rgba(0,0,0,0.5)" }}
          >
            <ModalTitleBar title="Добавить провайдер" onClose={onClose} />

            <div className="flex-1 overflow-y-auto p-4">
              {/* Step indicator — 2 steps */}
              <div className="flex items-center gap-2 mb-4">
                {[1, 2].map((s) => (
                  <div
                    key={s}
                    className={`h-1 flex-1 rounded-full transition-colors ${
                      s <= step ? "bg-accent" : "bg-border"
                    }`}
                  />
                ))}
              </div>

              {/* Step 1: Choose preset */}
              {step === 1 && (
                <div className="space-y-3">
                  <p className="text-sm text-muted-fg mb-3">Выберите CLI или создайте свой:</p>
                  <div className="grid grid-cols-2 gap-2">
                    {PROVIDER_PRESETS.map((preset) => {
                      const Icon = getProviderIcon(preset.icon);
                      return (
                        <button
                          key={preset.slug}
                          onClick={() => handlePresetSelect(preset)}
                          className="flex items-center gap-3 p-3 rounded-lg border border-border hover:border-accent hover:bg-surface-hover transition-all cursor-pointer text-left"
                        >
                          <div
                            className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                            style={{ backgroundColor: preset.color + "20", color: preset.color }}
                          >
                            <Icon className="w-5 h-5" />
                          </div>
                          <div>
                            <div className="text-sm font-medium text-foreground">{preset.name}</div>
                            <div className="text-xs text-muted-fg font-mono">{preset.command}</div>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  <button
                    onClick={handleCustom}
                    className="w-full flex items-center justify-center gap-2 p-3 rounded-lg border border-dashed border-border hover:border-accent hover:bg-surface-hover transition-all cursor-pointer text-sm text-muted-fg hover:text-foreground"
                  >
                    Другое (кастомный CLI)
                  </button>
                </div>
              )}

              {/* Step 2: Configure + collapsible terminal */}
              {step === 2 && (
                <div className="space-y-4">
                  {/* Form fields */}
                  <div>
                    <label className="block text-xs text-muted-fg mb-1.5">Название *</label>
                    <input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Codex"
                      className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-surface-alt text-foreground outline-none focus:border-accent"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-muted-fg mb-1.5">Slug *</label>
                    <input
                      value={slug}
                      onChange={(e) => { setSlug(e.target.value); setSlugManual(true); }}
                      placeholder="codex"
                      className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-surface-alt text-foreground font-mono outline-none focus:border-accent"
                    />
                    <p className="text-[10px] text-muted mt-1">Уникальный идентификатор (a-z, 0-9, -)</p>
                  </div>
                  <div>
                    <label className="block text-xs text-muted-fg mb-1.5">Команда запуска *</label>
                    <input
                      value={command}
                      onChange={(e) => setCommand(e.target.value)}
                      placeholder="codex"
                      className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-surface-alt text-foreground font-mono outline-none focus:border-accent"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-muted-fg mb-1.5">Команда resume</label>
                    <input
                      value={resumeCommand}
                      onChange={(e) => setResumeCommand(e.target.value)}
                      placeholder="codex --continue (опционально)"
                      className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-surface-alt text-foreground font-mono outline-none focus:border-accent"
                    />
                    <p className="text-[10px] text-muted mt-1">Если пусто — при resume используется обычная команда</p>
                  </div>

                  {/* Collapsible terminal section */}
                  <div className="border-t border-border pt-3">
                    <button
                      onClick={handleToggleTerminal}
                      className="flex items-center gap-2 w-full text-left text-sm text-muted-fg hover:text-foreground transition-colors cursor-pointer py-1"
                    >
                      <TerminalIcon className="w-4 h-4" />
                      <span className="flex-1">Терминал (установка / авторизация)</span>
                      <div className="flex items-center gap-2">
                        {terminalOpen && ephemeralId && (
                          <span className={`text-xs font-mono ${timeLeft < 60 ? "text-danger" : "text-muted-fg"}`}>
                            {formatTime(timeLeft)}
                          </span>
                        )}
                        {terminalOpen ? (
                          <ChevronUp className="w-3.5 h-3.5" />
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5" />
                        )}
                      </div>
                    </button>

                    {/* Terminal expand — theme-aware */}
                    {isRetro ? (
                      // Retro: simple toggle, no animation
                      terminalOpen && (
                        <div className="mt-2">
                          {terminalContent}
                        </div>
                      )
                    ) : (
                      // Dark: motion animation
                      <AnimatePresence initial={false}>
                        {terminalOpen && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
                            className="overflow-hidden"
                          >
                            <div className="mt-2">
                              {terminalContent}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    )}
                  </div>

                  {error && (
                    <p className="text-xs text-danger">{error}</p>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="border-t border-border px-4 py-3 flex items-center justify-between gap-2 shrink-0">
              <div>
                {step > 1 && (
                  <button
                    onClick={() => setStep(1)}
                    className="flex items-center gap-1 text-sm text-muted-fg hover:text-foreground transition-colors cursor-pointer"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    Назад
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2">
                {step === 2 && (
                  <button
                    onClick={handleSave}
                    disabled={saving || !name.trim() || !slug.trim() || !command.trim()}
                    className="px-4 py-1.5 text-sm rounded-lg bg-accent text-white font-medium hover:brightness-110 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {saving ? "Сохранение..." : "Сохранить"}
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

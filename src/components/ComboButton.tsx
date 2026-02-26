"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { HoverBorderGradient } from "@/components/ui/hover-border-gradient";
import { ChevronDown, Plus, Settings, Check } from "@/components/Icons";
import { getProviderIcon } from "@/lib/provider-icons";
import type { Provider } from "@/lib/ProviderContext";

interface ComboButtonProps {
  providers: Provider[];
  selectedSlug: string;
  onSelect: (slug: string) => void;
  onCreate: (slug: string) => void;
  onAddProvider: () => void;
  onConfigureProvider: (provider: Provider) => void;
  creating?: boolean;
  disabled?: boolean;
  variant?: "sidebar" | "welcome";
}

export default function ComboButton({
  providers,
  selectedSlug,
  onSelect,
  onCreate,
  onAddProvider,
  onConfigureProvider,
  creating,
  disabled,
  variant = "sidebar",
}: ComboButtonProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const selectedProvider = providers.find((p) => p.slug === selectedSlug);
  const SelectedIcon = getProviderIcon(selectedProvider?.icon || "default");

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open]);

  const handleMainClick = useCallback(() => {
    if (creating || disabled) return;
    onCreate(selectedSlug);
  }, [creating, disabled, onCreate, selectedSlug]);

  const handleToggle = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (disabled) return;
    setOpen((prev) => !prev);
  }, [disabled]);

  const handleSelectItem = useCallback((slug: string) => {
    onSelect(slug);
    setOpen(false);
    // Persist selection
    try { localStorage.setItem("selectedProvider", slug); } catch {}
  }, [onSelect]);

  const isWelcome = variant === "welcome";

  return (
    <div ref={ref} className={`relative ${isWelcome ? "inline-flex" : "w-full"}`}>
      <HoverBorderGradient
        as="div"
        containerClassName={isWelcome ? "mx-auto" : "w-full"}
        className={`w-full flex items-center bg-surface text-foreground ${
          isWelcome ? "px-6 py-3 text-sm" : "px-4 py-2 text-sm"
        } font-medium`}
      >
        {/* Main button area */}
        <button
          onClick={handleMainClick}
          disabled={creating || disabled}
          className="flex items-center gap-2 flex-1 min-w-0 cursor-pointer disabled:cursor-not-allowed"
        >
          {creating ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin flex-shrink-0" />
              <span>Создание...</span>
            </>
          ) : (
            <>
              <SelectedIcon className="w-4 h-4 flex-shrink-0" />
              <span className="truncate">{selectedProvider?.name || "Новый чат"}</span>
            </>
          )}
        </button>

        {/* Chevron divider + dropdown toggle */}
        <div className="flex items-center ml-2 -mr-1">
          <div className="w-px h-5 bg-border mx-1" />
          <button
            onClick={handleToggle}
            className="p-1 hover:bg-surface-hover rounded transition-colors cursor-pointer"
          >
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
          </button>
        </div>
      </HoverBorderGradient>

      {/* Dropdown */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className={`absolute z-50 mt-1 ${
              isWelcome ? "left-1/2 -translate-x-1/2 min-w-[240px]" : "left-0 right-0"
            } bg-surface border border-border rounded-lg overflow-hidden`}
            style={{
              boxShadow: "var(--th-shadow, 0 0 0 transparent), 0 8px 30px -8px rgba(0,0,0,0.4)",
            }}
          >
            <div className="py-1">
              {providers.map((provider) => {
                const Icon = getProviderIcon(provider.icon);
                const isSelected = provider.slug === selectedSlug;

                return (
                  <DropdownItem
                    key={provider.slug}
                    provider={provider}
                    Icon={Icon}
                    isSelected={isSelected}
                    onSelect={() => handleSelectItem(provider.slug)}
                    onConfigure={() => {
                      onConfigureProvider(provider);
                      setOpen(false);
                    }}
                  />
                );
              })}
            </div>

            {/* Separator + Add option */}
            <div className="border-t border-border">
              <button
                onClick={() => {
                  onAddProvider();
                  setOpen(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-muted-fg hover:text-foreground hover:bg-surface-hover transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Добавить опцию</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function DropdownItem({
  provider,
  Icon,
  isSelected,
  onSelect,
  onConfigure,
}: {
  provider: Provider;
  Icon: React.FC<{ className?: string }>;
  isSelected: boolean;
  onSelect: () => void;
  onConfigure: () => void;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onSelect}
      className={`flex items-center gap-2 px-3 py-2 cursor-pointer transition-colors ${
        isSelected ? "bg-accent-hover" : "hover:bg-surface-hover"
      }`}
    >
      <div
        className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0"
        style={{ color: provider.color }}
      >
        <Icon className="w-4 h-4" />
      </div>
      <span className="text-sm text-foreground flex-1 truncate">{provider.name}</span>

      {isSelected && !hovered && (
        <Check className="w-3.5 h-3.5 text-accent-fg flex-shrink-0" />
      )}

      {hovered && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onConfigure();
          }}
          className="p-0.5 text-muted-fg hover:text-foreground transition-colors cursor-pointer"
          title="Настройки"
        >
          <Settings className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

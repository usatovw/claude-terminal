"use client";

import { useOS } from "@/lib/useOS";

interface ModalTitleBarProps {
  title: string;
  onClose: () => void;
}

function MacTitleBar({ title, onClose }: ModalTitleBarProps) {
  return (
    <div className="flex items-center h-11 px-3.5 border-b border-border select-none shrink-0 bg-surface-alt">
      <div className="flex items-center gap-2 mr-3">
        <button
          onClick={onClose}
          className="w-[13px] h-[13px] rounded-full bg-[#ff5f57] hover:brightness-90 transition cursor-pointer group flex items-center justify-center"
          aria-label="Закрыть"
        >
          <svg
            className="w-[7px] h-[7px] text-[#4d0000] opacity-0 group-hover:opacity-100 transition-opacity"
            viewBox="0 0 12 12"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
          >
            <path d="M2 2l8 8M10 2l-8 8" />
          </svg>
        </button>
        <div className="w-[13px] h-[13px] rounded-full bg-[#febc2e]" />
        <div className="w-[13px] h-[13px] rounded-full bg-[#28c840]" />
      </div>
      <span className="text-xs text-muted-fg font-medium flex-1 text-center -ml-[60px]">
        {title}
      </span>
    </div>
  );
}

function WindowsTitleBar({ title, onClose }: ModalTitleBarProps) {
  return (
    <div className="flex items-center justify-between h-10 pl-3.5 border-b border-border select-none shrink-0 bg-surface-alt">
      <span className="text-xs text-muted-fg font-medium">
        {title}
      </span>
      <div className="flex items-center h-full">
        <div className="w-[46px] h-full flex items-center justify-center text-muted-fg">
          <svg width="10" height="1" viewBox="0 0 10 1" fill="currentColor">
            <rect width="10" height="1" />
          </svg>
        </div>
        <div className="w-[46px] h-full flex items-center justify-center text-muted-fg">
          <svg
            width="10"
            height="10"
            viewBox="0 0 10 10"
            fill="none"
            stroke="currentColor"
            strokeWidth="1"
          >
            <rect x="0.5" y="0.5" width="9" height="9" />
          </svg>
        </div>
        <button
          onClick={onClose}
          className="w-[46px] h-full flex items-center justify-center text-muted-fg hover:bg-[#e81123] hover:text-white transition-colors cursor-pointer rounded-tr-[var(--th-radius)]"
          aria-label="Закрыть"
        >
          <svg
            width="10"
            height="10"
            viewBox="0 0 10 10"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
          >
            <path d="M1 1l8 8M9 1l-8 8" />
          </svg>
        </button>
      </div>
    </div>
  );
}

export default function ModalTitleBar({ title, onClose }: ModalTitleBarProps) {
  const os = useOS();
  return os === "mac" ? (
    <MacTitleBar title={title} onClose={onClose} />
  ) : (
    <WindowsTitleBar title={title} onClose={onClose} />
  );
}

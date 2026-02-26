import React from "react";

interface IconProps {
  className?: string;
}

function TerminalProviderIcon({ className = "w-4 h-4" }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="18" rx="2" />
      <polyline points="7 15 10 12 7 9" />
      <line x1="13" x2="17" y1="15" y2="15" />
    </svg>
  );
}

function ClaudeProviderIcon({ className = "w-4 h-4" }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3Z" />
      <path d="M18 14l.75 2.25L21 17l-2.25.75L18 20l-.75-2.25L15 17l2.25-.75L18 14Z" />
      <path d="M5 17l.5 1.5L7 19l-1.5.5L5 21l-.5-1.5L3 19l1.5-.5L5 17Z" />
    </svg>
  );
}

function CodexProviderIcon({ className = "w-4 h-4" }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="16 18 22 12 16 6" />
      <polyline points="8 6 2 12 8 18" />
      <line x1="14" y1="4" x2="10" y2="20" />
    </svg>
  );
}

function GeminiProviderIcon({ className = "w-4 h-4" }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2l5 10-5 10-5-10L12 2Z" />
      <path d="M2 12h20" />
    </svg>
  );
}

function AiderProviderIcon({ className = "w-4 h-4" }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 4L5 20h4l3-8 3 8h4L12 4Z" />
    </svg>
  );
}

function AmazonQProviderIcon({ className = "w-4 h-4" }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="11" r="7" />
      <path d="M15 14l4 6" />
      <path d="M10 8a3 3 0 0 1 5 2c0 2-3 3-3 3" />
    </svg>
  );
}

function DefaultProviderIcon({ className = "w-4 h-4" }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="4 17 10 11 4 5" />
      <line x1="12" x2="20" y1="19" y2="19" />
    </svg>
  );
}

const ICON_MAP: Record<string, React.FC<IconProps>> = {
  terminal: TerminalProviderIcon,
  claude: ClaudeProviderIcon,
  codex: CodexProviderIcon,
  gemini: GeminiProviderIcon,
  aider: AiderProviderIcon,
  amazonq: AmazonQProviderIcon,
  default: DefaultProviderIcon,
};

export function getProviderIcon(iconId: string): React.FC<IconProps> {
  return ICON_MAP[iconId] || ICON_MAP.default;
}

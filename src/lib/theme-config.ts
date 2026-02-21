import type { ThemeId } from "./ThemeContext";

interface TerminalTheme {
  background: string;
  foreground: string;
  cursor: string;
  cursorAccent: string;
  selectionBackground: string;
  selectionForeground: string;
  black: string;
  red: string;
  green: string;
  yellow: string;
  blue: string;
  magenta: string;
  cyan: string;
  white: string;
  brightBlack: string;
  brightRed: string;
  brightGreen: string;
  brightYellow: string;
  brightBlue: string;
  brightMagenta: string;
  brightCyan: string;
  brightWhite: string;
}

interface CursorTheme {
  bubbleBg: string;
  bubbleBorder: string;
  inputBg: string;
  textColor: string;
}

interface LampTheme {
  gradientColor: string;
  bgColor: string;
  lineColor: string;
  glowColor: string;
  maskColor: string;
}

interface ThemeConfig {
  terminal: TerminalTheme;
  cursor: CursorTheme;
  lamp: LampTheme;
  spotlightFill: string;
}

export const themeConfigs: Record<ThemeId, ThemeConfig> = {
  dark: {
    terminal: {
      background: "#0a0a0a",
      foreground: "#e0e0e0",
      cursor: "#ffffff",
      cursorAccent: "#0a0a0a",
      selectionBackground: "#264f78",
      selectionForeground: "#ffffff",
      black: "#1a1a2e",
      red: "#ff6b6b",
      green: "#51cf66",
      yellow: "#ffd43b",
      blue: "#748ffc",
      magenta: "#cc5de8",
      cyan: "#66d9e8",
      white: "#e0e0e0",
      brightBlack: "#495057",
      brightRed: "#ff8787",
      brightGreen: "#69db7c",
      brightYellow: "#ffe066",
      brightBlue: "#91a7ff",
      brightMagenta: "#e599f7",
      brightCyan: "#99e9f2",
      brightWhite: "#ffffff",
    },
    cursor: {
      bubbleBg: "rgba(9, 9, 11, 0.85)",
      bubbleBorder: "50",
      inputBg: "rgba(9, 9, 11, 0.85)",
      textColor: "#e4e4e7",
    },
    lamp: {
      gradientColor: "#8b5cf6",
      bgColor: "#000000",
      lineColor: "#8b5cf6",
      glowColor: "rgba(139, 92, 246, 0.3)",
      maskColor: "#000000",
    },
    spotlightFill: "rgba(139, 92, 246, 0.15)",
  },
  retro: {
    terminal: {
      background: "#2d2b28",
      foreground: "#d8d3c5",
      cursor: "#e09000",
      cursorAccent: "#2d2b28",
      selectionBackground: "#5a5548",
      selectionForeground: "#ede8da",
      black: "#2d2b28",
      red: "#c0392b",
      green: "#2e7d32",
      yellow: "#e09000",
      blue: "#4481eb",
      magenta: "#b066cc",
      cyan: "#45a5a5",
      white: "#d8d3c5",
      brightBlack: "#6b6560",
      brightRed: "#ff6b6b",
      brightGreen: "#66bb6a",
      brightYellow: "#ffca28",
      brightBlue: "#5c9cf5",
      brightMagenta: "#ce93d8",
      brightCyan: "#5fc0c0",
      brightWhite: "#ede8da",
    },
    cursor: {
      bubbleBg: "rgba(255, 255, 255, 0.95)",
      bubbleBorder: "80",
      inputBg: "rgba(255, 255, 255, 0.95)",
      textColor: "#1a1a1a",
    },
    lamp: {
      gradientColor: "#e09000",
      bgColor: "#d8d3c5",
      lineColor: "#e09000",
      glowColor: "rgba(224, 144, 0, 0.3)",
      maskColor: "#d8d3c5",
    },
    spotlightFill: "rgba(224, 144, 0, 0.15)",
  },
};

export interface ProviderPreset {
  name: string;
  slug: string;
  command: string;
  resumeCommand: string | null;
  icon: string;
  color: string;
  installHint: string;
}

export const PROVIDER_PRESETS: ProviderPreset[] = [
  { name: "Codex", slug: "codex", command: "codex", resumeCommand: null, icon: "codex", color: "#10b981", installHint: "npm install -g @openai/codex" },
  { name: "Gemini CLI", slug: "gemini", command: "gemini", resumeCommand: null, icon: "gemini", color: "#4285f4", installHint: "npm install -g @google/gemini-cli" },
  { name: "Aider", slug: "aider", command: "aider", resumeCommand: null, icon: "aider", color: "#f59e0b", installHint: "pip install aider-install && aider-install" },
  { name: "Amazon Q", slug: "amazonq", command: "q chat", resumeCommand: null, icon: "amazonq", color: "#ff9900", installHint: "brew install amazon-q" },
];

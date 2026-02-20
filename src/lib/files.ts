import path from "path";

/**
 * Resolve a relative path within a project directory, guarding against path traversal.
 * Returns the absolute path if safe, or null if the path escapes the project directory.
 */
export function safePath(projectDir: string, relativePath: string): string | null {
  const resolved = path.resolve(projectDir, relativePath);
  if (!resolved.startsWith(projectDir + path.sep) && resolved !== projectDir) {
    return null;
  }
  return resolved;
}

interface SessionInfo {
  sessionId: string;
  projectDir: string;
  isActive: boolean;
}

interface TerminalManagerWithGetSession {
  getSession: (id: string) => SessionInfo | null;
}

/**
 * Get the project directory for a session via the global terminal manager.
 */
export function getSessionProjectDir(sessionId: string): string | null {
  const tm = (global as Record<string, unknown>).terminalManager as TerminalManagerWithGetSession | undefined;
  if (!tm) return null;
  const session = tm.getSession(sessionId);
  return session?.projectDir ?? null;
}

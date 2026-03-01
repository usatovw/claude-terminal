import path from "path";
import fs from "fs/promises";

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

/**
 * Resolve a path and verify its real path (after symlink resolution) stays within projectDir.
 * Guards against symlink attacks where a symlink points outside the project.
 */
export async function safeRealPath(projectDir: string, relativePath: string): Promise<string | null> {
  const resolved = safePath(projectDir, relativePath);
  if (!resolved) return null;

  try {
    const stat = await fs.lstat(resolved);
    if (stat.isSymbolicLink()) {
      const real = await fs.realpath(resolved);
      if (!real.startsWith(projectDir + path.sep) && real !== projectDir) {
        return null;
      }
      return real;
    }
    return resolved;
  } catch {
    // File doesn't exist yet (for create operations) — fall back to safePath
    return resolved;
  }
}

/**
 * Check if a buffer contains binary data by looking for null bytes.
 */
export function isBinaryBuffer(buffer: Buffer, bytesToCheck = 8192): boolean {
  const len = Math.min(buffer.length, bytesToCheck);
  for (let i = 0; i < len; i++) {
    if (buffer[i] === 0) return true;
  }
  return false;
}

/**
 * Validate a filename for safety.
 */
export function isValidFilename(name: string): boolean {
  if (!name || !name.trim()) return false;
  // No control characters
  if (/[\x00-\x1f\x7f]/.test(name)) return false;
  // No slashes or backslashes
  if (/[/\\]/.test(name)) return false;
  // No .. traversal
  if (name === ".." || name === ".") return false;
  // Byte length limit
  if (Buffer.byteLength(name, "utf-8") > 255) return false;
  return true;
}

/**
 * Validate a file path that may contain nested directories (e.g. "src/utils/helpers").
 * Each segment must be a valid filename.
 */
export function isValidFilePath(filepath: string): boolean {
  const parts = filepath.split("/").filter(Boolean);
  if (parts.length === 0) return false;
  return parts.every(part => isValidFilename(part));
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

/**
 * Editor utilities: file type detection, language mapping, preview types.
 */

export type PreviewType = "markdown" | "html" | "image" | "svg" | "json" | "csv" | null;

const LANGUAGE_MAP: Record<string, string> = {
  // JavaScript / TypeScript
  js: "javascript", jsx: "javascript", mjs: "javascript", cjs: "javascript",
  ts: "javascript", tsx: "javascript", mts: "javascript", cts: "javascript",
  // Web
  html: "html", htm: "html", vue: "html", svelte: "html",
  css: "css", scss: "css", less: "css",
  // Data
  json: "json", jsonc: "json", json5: "json",
  xml: "xml", xsl: "xml", xsd: "xml", plist: "xml",
  yaml: "yaml", yml: "yaml",
  // Markdown
  md: "markdown", mdx: "markdown",
  // Programming
  py: "python", pyw: "python", pyi: "python",
  rs: "rust",
  go: "go",
  java: "java", kt: "java", kts: "java",
  cpp: "cpp", cc: "cpp", cxx: "cpp", c: "cpp", h: "cpp", hpp: "cpp", hxx: "cpp",
  php: "php", phtml: "php",
  sql: "sql",
  wast: "wast", wat: "wast",
  // Config / Shell
  sh: "shell", bash: "shell", zsh: "shell", fish: "shell",
  dockerfile: "dockerfile",
  toml: "toml", ini: "ini", cfg: "ini",
  // Others
  r: "r", rb: "ruby", swift: "swift", scala: "scala",
  lua: "lua", perl: "perl", pl: "perl",
};

// Binary file extensions that should never be opened in the editor
const BINARY_EXTENSIONS = new Set([
  "png", "jpg", "jpeg", "gif", "bmp", "ico", "webp", "avif", "tiff", "tif",
  "mp3", "mp4", "avi", "mov", "wmv", "flv", "mkv", "webm", "ogg", "wav", "flac",
  "zip", "tar", "gz", "bz2", "xz", "7z", "rar", "zst",
  "pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx",
  "exe", "dll", "so", "dylib", "bin", "dat",
  "woff", "woff2", "ttf", "otf", "eot",
  "sqlite", "db", "sqlite3",
  "pyc", "pyo", "class", "o", "obj",
]);

// Image extensions that can be previewed
const IMAGE_EXTENSIONS = new Set([
  "png", "jpg", "jpeg", "gif", "webp", "avif", "bmp", "ico",
]);

/**
 * Get the CodeMirror language identifier for a file extension.
 */
export function getLanguageForExtension(ext: string): string | null {
  return LANGUAGE_MAP[ext.toLowerCase()] ?? null;
}

/**
 * Get the language from a filename (handles special names like Dockerfile).
 */
export function getLanguageForFile(filename: string): string | null {
  const lower = filename.toLowerCase();
  // Special filenames
  if (lower === "dockerfile" || lower.startsWith("dockerfile.")) return "dockerfile";
  if (lower === "makefile" || lower === "gnumakefile") return "shell";
  if (lower === ".gitignore" || lower === ".dockerignore" || lower === ".env") return "shell";
  if (lower === "cmakelists.txt") return "cmake";

  const ext = getExtension(filename);
  if (!ext) return null;
  return getLanguageForExtension(ext);
}

/**
 * Get file extension (without dot), lowercase.
 */
export function getExtension(filename: string): string {
  const dot = filename.lastIndexOf(".");
  if (dot <= 0) return "";
  return filename.slice(dot + 1).toLowerCase();
}

/**
 * Check if a file is likely a text file based on extension.
 */
export function isTextFile(filename: string): boolean {
  const ext = getExtension(filename);
  if (!ext) return true; // No extension — assume text
  return !BINARY_EXTENSIONS.has(ext);
}

/**
 * Check if a file is a known binary file.
 */
export function isBinaryFile(filename: string): boolean {
  const ext = getExtension(filename);
  if (!ext) return false;
  return BINARY_EXTENSIONS.has(ext);
}

/**
 * Check if a file is an image that can be previewed.
 */
export function isImageFile(filename: string): boolean {
  const ext = getExtension(filename);
  return IMAGE_EXTENSIONS.has(ext);
}

/**
 * Determine the preview type for a file.
 */
export function getPreviewType(filename: string): PreviewType {
  const ext = getExtension(filename);
  const lower = filename.toLowerCase();

  if (ext === "md" || ext === "mdx") return "markdown";
  if (ext === "html" || ext === "htm") return "html";
  if (ext === "svg") return "svg";
  if (IMAGE_EXTENSIONS.has(ext)) return "image";
  if (ext === "json" || ext === "jsonc" || ext === "json5") return "json";
  if (ext === "csv" || ext === "tsv") return "csv";
  // Check for special filenames
  if (lower === "readme" || lower === "changelog" || lower === "license") return "markdown";

  return null;
}

/**
 * Check if a file supports preview.
 */
export function isPreviewable(filename: string): boolean {
  return getPreviewType(filename) !== null;
}

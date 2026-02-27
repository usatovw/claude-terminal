"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { marked, type Token, type Tokens } from "marked";
import hljs from "highlight.js/lib/core";
import javascript from "highlight.js/lib/languages/javascript";
import typescript from "highlight.js/lib/languages/typescript";
import python from "highlight.js/lib/languages/python";
import bash from "highlight.js/lib/languages/bash";
import json from "highlight.js/lib/languages/json";
import css from "highlight.js/lib/languages/css";
import xml from "highlight.js/lib/languages/xml";
import sql from "highlight.js/lib/languages/sql";
import markdown from "highlight.js/lib/languages/markdown";
import go from "highlight.js/lib/languages/go";
import rust from "highlight.js/lib/languages/rust";
import yaml from "highlight.js/lib/languages/yaml";
import dockerfile from "highlight.js/lib/languages/dockerfile";
import { ArrowLeft, Save } from "@/components/Icons";
import { useUser } from "@/lib/UserContext";

hljs.registerLanguage("javascript", javascript);
hljs.registerLanguage("js", javascript);
hljs.registerLanguage("typescript", typescript);
hljs.registerLanguage("ts", typescript);
hljs.registerLanguage("python", python);
hljs.registerLanguage("py", python);
hljs.registerLanguage("bash", bash);
hljs.registerLanguage("sh", bash);
hljs.registerLanguage("shell", bash);
hljs.registerLanguage("json", json);
hljs.registerLanguage("css", css);
hljs.registerLanguage("xml", xml);
hljs.registerLanguage("html", xml);
hljs.registerLanguage("sql", sql);
hljs.registerLanguage("markdown", markdown);
hljs.registerLanguage("md", markdown);
hljs.registerLanguage("go", go);
hljs.registerLanguage("rust", rust);
hljs.registerLanguage("yaml", yaml);
hljs.registerLanguage("yml", yaml);
hljs.registerLanguage("dockerfile", dockerfile);
hljs.registerLanguage("docker", dockerfile);

interface MarkdownViewerProps {
  sessionId: string;
  filePath: string;
  fileName: string;
  onClose: () => void;
  onNavigate?: (path: string, name: string) => void;
}

export default function MarkdownViewer({
  sessionId,
  filePath,
  fileName,
  onClose,
  onNavigate,
}: MarkdownViewerProps) {
  const { isGuest } = useUser();
  const [content, setContent] = useState("");
  const [tokens, setTokens] = useState<Token[]>([]);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingRaw, setEditingRaw] = useState("");
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // Load file content
  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/sessions/${sessionId}/files/read?path=${encodeURIComponent(filePath)}`)
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          if (res.status === 413) {
            throw new Error(`Файл слишком большой (${formatSize(data.size)}). Лимит: 1 МБ`);
          }
          throw new Error(data.error || "Не удалось загрузить файл");
        }
        return res.json();
      })
      .then((data) => {
        setContent(data.content);
        setTokens(marked.lexer(data.content));
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [sessionId, filePath]);

  // Ctrl+S save
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        if (dirty && !saving && !isGuest) {
          handleSave();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dirty, saving, isGuest, tokens, editingIndex, editingRaw]);

  const handleSave = useCallback(async () => {
    // Commit any in-progress edit first
    let finalTokens = tokens;
    if (editingIndex !== null) {
      const newTokens = [...tokens];
      const updated = marked.lexer(editingRaw);
      if (updated.length > 0) {
        newTokens.splice(editingIndex, 1, ...updated);
      } else {
        newTokens.splice(editingIndex, 1);
      }
      finalTokens = newTokens;
      setTokens(finalTokens);
      setEditingIndex(null);
      setEditingRaw("");
    }

    const newContent = finalTokens.map((t) => t.raw).join("");
    setSaving(true);
    try {
      const res = await fetch(`/api/sessions/${sessionId}/files/write`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: filePath, content: newContent }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Ошибка сохранения");
      }
      setContent(newContent);
      setDirty(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка сохранения");
    }
    setSaving(false);
  }, [tokens, editingIndex, editingRaw, sessionId, filePath]);

  const handleBlockClick = useCallback(
    (index: number) => {
      if (isGuest) return;
      if (editingIndex === index) return;

      // Commit previous block edit if any
      if (editingIndex !== null) {
        commitEdit();
      }

      setEditingIndex(index);
      setEditingRaw(tokens[index].raw);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isGuest, editingIndex, tokens]
  );

  const commitEdit = useCallback(() => {
    if (editingIndex === null) return;
    const oldRaw = tokens[editingIndex].raw;
    if (editingRaw !== oldRaw) {
      const newTokens = [...tokens];
      const updated = marked.lexer(editingRaw);
      if (updated.length > 0) {
        newTokens.splice(editingIndex, 1, ...updated);
      } else {
        newTokens.splice(editingIndex, 1);
      }
      setTokens(newTokens);
      setDirty(true);
    }
    setEditingIndex(null);
    setEditingRaw("");
  }, [editingIndex, editingRaw, tokens]);

  const handleTextareaKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        commitEdit();
      }
    },
    [commitEdit]
  );

  // Auto-resize textarea
  useEffect(() => {
    if (editingIndex !== null && textareaRef.current) {
      const ta = textareaRef.current;
      ta.focus();
      ta.style.height = "auto";
      ta.style.height = ta.scrollHeight + "px";
    }
  }, [editingIndex, editingRaw]);

  // Intercept clicks on .md links (relative AND absolute with our domain)
  // Stored as ref so it's always fresh, attached via callback ref on contentRef
  const linkHandlerRef = useRef<((e: MouseEvent) => void) | null>(null);
  const contentElRef = useRef<HTMLDivElement | null>(null);

  linkHandlerRef.current = (e: MouseEvent) => {
    const anchor = (e.target as HTMLElement).closest("a");
    if (!anchor) return;

    const href = anchor.getAttribute("href");
    if (!href) return;
    if (!onNavigate) return;

    let mdPath: string | null = null;

    // 1) Absolute URL pointing to our own host → extract path
    if (/^https?:\/\//i.test(href)) {
      try {
        const url = new URL(href);
        if (url.origin === window.location.origin && url.pathname.endsWith(".md")) {
          mdPath = url.pathname.replace(/^\/+/, "");
        }
      } catch {
        // invalid URL, ignore
      }
    }

    // 2) Relative .md link — resolve relative to current file's directory
    if (!mdPath && !href.startsWith("mailto:") && !href.startsWith("#") && href.endsWith(".md")) {
      const dir = filePath.includes("/") ? filePath.slice(0, filePath.lastIndexOf("/")) : ".";
      mdPath = dir === "." ? href : dir + "/" + href;
    }

    if (!mdPath) return;

    e.preventDefault();
    e.stopPropagation();

    // Normalize: collapse "foo/../bar" → "bar"
    const parts = mdPath.split("/");
    const normalized: string[] = [];
    for (const p of parts) {
      if (p === "..") normalized.pop();
      else if (p !== ".") normalized.push(p);
    }
    const finalPath = normalized.join("/");
    const name = finalPath.split("/").pop() || finalPath;
    onNavigate(finalPath, name);
  };

  // Stable function identity for addEventListener/removeEventListener
  const stableLinkHandler = useCallback((e: MouseEvent) => {
    linkHandlerRef.current?.(e);
  }, []);

  // Callback ref: attaches click handler the moment the DOM element appears
  const setContentRef = useCallback((el: HTMLDivElement | null) => {
    // Detach from previous element
    if (contentElRef.current) {
      contentElRef.current.removeEventListener("click", stableLinkHandler);
    }
    contentElRef.current = el;
    contentRef.current = el;
    // Attach to new element
    if (el) {
      el.addEventListener("click", stableLinkHandler);
    }
  }, [stableLinkHandler]);

  // Filter out trailing space/newline-only tokens for rendering
  const renderableTokens = useMemo(
    () => tokens.filter((t) => t.type !== "space"),
    [tokens]
  );

  if (loading) {
    return (
      <div className="flex flex-col w-full h-full bg-background rounded-xl overflow-hidden">
        <Header fileName={fileName} onClose={onClose} />
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin h-6 w-6 border-2 border-accent border-t-transparent rounded-full" />
        </div>
      </div>
    );
  }

  if (error && !content) {
    return (
      <div className="flex flex-col w-full h-full bg-background rounded-xl overflow-hidden">
        <Header fileName={fileName} onClose={onClose} />
        <div className="flex-1 flex items-center justify-center px-4">
          <p className="text-danger text-sm text-center">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col w-full h-full bg-background rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
        <button
          onClick={onClose}
          className="flex items-center gap-1.5 text-muted-fg hover:text-foreground transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm">Назад</span>
        </button>
        <div className="flex-1 text-center">
          <span className="text-sm font-medium text-foreground">{fileName}</span>
          {dirty && <span className="text-xs text-warning ml-2">(изменён)</span>}
        </div>
        {!isGuest && (
          <button
            onClick={handleSave}
            disabled={!dirty || saving}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-all cursor-pointer ${
              dirty && !saving
                ? "bg-accent/20 text-accent-fg hover:bg-accent/30"
                : "text-muted opacity-50 cursor-not-allowed"
            }`}
          >
            <Save className="w-4 h-4" />
            <span className="hidden sm:inline">{saving ? "Сохранение..." : "Сохранить"}</span>
          </button>
        )}
      </div>

      {/* Error banner */}
      {error && (
        <div className="px-4 py-2 bg-danger/10 border-b border-danger/20">
          <p className="text-danger text-xs">{error}</p>
        </div>
      )}

      {/* Content */}
      <div ref={setContentRef} className="flex-1 overflow-y-auto px-4 md:px-8 py-6">
        <div className="max-w-3xl mx-auto md-viewer">
          {renderableTokens.map((token, i) => {
            const realIndex = tokens.indexOf(token);

            if (editingIndex === realIndex) {
              return (
                <div key={i} className="my-1">
                  <textarea
                    ref={textareaRef}
                    value={editingRaw}
                    onChange={(e) => {
                      setEditingRaw(e.target.value);
                      // auto-resize
                      e.target.style.height = "auto";
                      e.target.style.height = e.target.scrollHeight + "px";
                    }}
                    onBlur={commitEdit}
                    onKeyDown={handleTextareaKeyDown}
                    className="w-full bg-surface-alt border border-accent/30 rounded-md px-3 py-2 text-sm text-foreground font-mono outline-none focus:border-accent/60 resize-none overflow-hidden leading-relaxed"
                    spellCheck={false}
                  />
                </div>
              );
            }

            return (
              <MarkdownBlock
                key={i}
                token={token}
                onClick={() => handleBlockClick(realIndex)}
                isGuest={isGuest}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Header({ fileName, onClose }: { fileName: string; onClose: () => void }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
      <button
        onClick={onClose}
        className="flex items-center gap-1.5 text-muted-fg hover:text-foreground transition-colors cursor-pointer"
      >
        <ArrowLeft className="w-4 h-4" />
        <span className="text-sm">Назад</span>
      </button>
      <div className="flex-1 text-center">
        <span className="text-sm font-medium text-foreground">{fileName}</span>
      </div>
      <div className="w-[72px]" /> {/* spacer for centering */}
    </div>
  );
}

function MarkdownBlock({
  token,
  onClick,
  isGuest,
}: {
  token: Token;
  onClick: () => void;
  isGuest: boolean;
}) {
  const html = useMemo(() => renderToken(token), [token]);

  const handleClick = useCallback((e: React.MouseEvent) => {
    // Don't enter edit mode if user clicked a link
    if ((e.target as HTMLElement).closest("a")) return;
    onClick();
  }, [onClick]);

  return (
    <div
      onClick={handleClick}
      className={`rounded-md transition-colors duration-150 ${
        isGuest ? "" : "cursor-text hover:bg-surface-hover/30"
      }`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

function renderToken(token: Token): string {
  // Use marked.parser for a single token wrapped in a token list
  const renderer = new marked.Renderer();

  // Syntax highlighting for code blocks
  renderer.code = ({ text, lang }: Tokens.Code) => {
    let highlighted: string;
    if (lang && hljs.getLanguage(lang)) {
      highlighted = hljs.highlight(text, { language: lang }).value;
    } else {
      highlighted = hljs.highlightAuto(text).value;
    }
    const langLabel = lang ? `<span class="absolute top-2 right-3 text-xs text-muted select-none">${escapeHtml(lang)}</span>` : "";
    return `<pre class="relative"><code class="hljs">${highlighted}</code>${langLabel}</pre>`;
  };

  // Create a minimal token list structure for marked.parser
  const tokenList = Object.assign([token], { links: {} });
  return marked.parser(tokenList as Parameters<typeof marked.parser>[0], { renderer });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + " Б";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " КБ";
  return (bytes / (1024 * 1024)).toFixed(1) + " МБ";
}

"use client";

import { useMemo, useRef, useEffect, useCallback } from "react";
import { marked } from "marked";
import hljs from "highlight.js/lib/core";
import javascript from "highlight.js/lib/languages/javascript";
import typescript from "highlight.js/lib/languages/typescript";
import python from "highlight.js/lib/languages/python";
import bash from "highlight.js/lib/languages/bash";
import json from "highlight.js/lib/languages/json";
import css from "highlight.js/lib/languages/css";
import xml from "highlight.js/lib/languages/xml";
import sql from "highlight.js/lib/languages/sql";
import go from "highlight.js/lib/languages/go";
import rust from "highlight.js/lib/languages/rust";
import yaml from "highlight.js/lib/languages/yaml";

// Register languages
const registered = new Set<string>();
function reg(name: string, lang: unknown) {
  if (!registered.has(name)) {
    hljs.registerLanguage(name, lang as Parameters<typeof hljs.registerLanguage>[1]);
    registered.add(name);
  }
}
reg("javascript", javascript); reg("js", javascript);
reg("typescript", typescript); reg("ts", typescript);
reg("python", python); reg("py", python);
reg("bash", bash); reg("sh", bash); reg("shell", bash);
reg("json", json);
reg("css", css);
reg("xml", xml); reg("html", xml);
reg("sql", sql);
reg("go", go);
reg("rust", rust);
reg("yaml", yaml); reg("yml", yaml);

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/**
 * Pre-process markdown to fix fenced code blocks broken by list nesting.
 * Detects fences embedded inside list items (e.g. "  - ```javascript")
 * and extracts them as standalone blocks so marked parses them correctly.
 */
function normalizeCodeFences(md: string): string {
  const lines = md.split("\n");
  const out: string[] = [];
  let inFence = false;
  let fenceIndent = 0;

  for (const line of lines) {
    if (!inFence) {
      // Opening fence inside a list item: "  - ```lang" or "  * ```" etc.
      const m = line.match(/^(\s*)(?:[-*+]|\d+\.)\s*(```\w*)\s*$/);
      if (m) {
        fenceIndent = m[1].length;
        if (out.length > 0 && out[out.length - 1].trim() !== "") out.push("");
        out.push(m[2]);
        inFence = true;
        continue;
      }
      // Normal opening fence — track it to avoid false closes
      if (/^\s*```\w*\s*$/.test(line)) {
        inFence = true;
        fenceIndent = 0;
        out.push(line);
        continue;
      }
      out.push(line);
      continue;
    }

    // Inside fence — check for closing
    const stripped = line.replace(/^\s*/, "");
    if (/^```\s*$/.test(stripped)) {
      out.push("```");
      if (fenceIndent > 0) out.push(""); // blank line after extracted block
      inFence = false;
      continue;
    }
    // Strip leading indentation matching the list nesting
    if (fenceIndent > 0 && line.length > fenceIndent && line.slice(0, fenceIndent).trim() === "") {
      out.push(line.slice(fenceIndent));
    } else {
      out.push(line);
    }
  }
  return out.join("\n");
}

interface MarkdownPreviewProps {
  content: string;
  filePath: string;
  onNavigate?: (path: string, name: string) => void;
}

export default function MarkdownPreview({ content, filePath, onNavigate }: MarkdownPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const html = useMemo(() => {
    const renderer = new marked.Renderer();

    renderer.code = ({ text, lang }: { text: string; lang?: string }) => {
      // Skip empty code blocks (artifact of broken fence parsing)
      if (!text && !lang) return "";
      if (!text) return "";
      let highlighted: string;
      if (lang && hljs.getLanguage(lang)) {
        highlighted = hljs.highlight(text, { language: lang }).value;
      } else {
        highlighted = hljs.highlightAuto(text).value;
      }
      const langLabel = lang ? `<span class="absolute top-2 right-3 text-xs text-muted select-none">${escapeHtml(lang)}</span>` : "";
      return `<pre class="relative"><code class="hljs">${highlighted}</code>${langLabel}</pre>`;
    };

    const normalized = normalizeCodeFences(content);
    return marked.parse(normalized, { renderer, gfm: true }) as string;
  }, [content]);

  // Intercept .md link clicks
  const handleClick = useCallback((e: MouseEvent) => {
    if (!onNavigate) return;
    const anchor = (e.target as HTMLElement).closest("a");
    if (!anchor) return;
    const href = anchor.getAttribute("href");
    if (!href) return;

    let mdPath: string | null = null;

    if (/^https?:\/\//i.test(href)) {
      try {
        const url = new URL(href);
        if (url.origin === window.location.origin && url.pathname.endsWith(".md")) {
          mdPath = url.pathname.replace(/^\/+/, "");
        }
      } catch { /* ignore */ }
    }

    if (!mdPath && !href.startsWith("mailto:") && !href.startsWith("#") && href.endsWith(".md")) {
      const dir = filePath.includes("/") ? filePath.slice(0, filePath.lastIndexOf("/")) : ".";
      mdPath = dir === "." ? href : dir + "/" + href;
    }

    if (!mdPath) return;
    e.preventDefault();
    e.stopPropagation();

    const parts = mdPath.split("/");
    const normalized: string[] = [];
    for (const p of parts) {
      if (p === "..") normalized.pop();
      else if (p !== ".") normalized.push(p);
    }
    const finalPath = normalized.join("/");
    const name = finalPath.split("/").pop() || finalPath;
    onNavigate(finalPath, name);
  }, [filePath, onNavigate]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener("click", handleClick);
    return () => el.removeEventListener("click", handleClick);
  }, [handleClick]);

  return (
    <div
      ref={containerRef}
      className="h-full overflow-y-auto px-4 md:px-6 py-4"
    >
      <div
        className="max-w-3xl mx-auto md-viewer"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}

"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightSpecialChars, drawSelection, dropCursor, rectangularSelection, crosshairCursor, highlightActiveLineGutter } from "@codemirror/view";
import { EditorState, type Extension } from "@codemirror/state";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { syntaxHighlighting, defaultHighlightStyle, indentOnInput, bracketMatching, foldGutter, foldKeymap } from "@codemirror/language";
import { autocompletion, completionKeymap, closeBrackets, closeBracketsKeymap } from "@codemirror/autocomplete";
import { searchKeymap, highlightSelectionMatches } from "@codemirror/search";
import { lintKeymap } from "@codemirror/lint";
import { cmTheme, cmHighlighting } from "@/lib/codemirror-theme";
import { getLanguageForFile } from "@/lib/editor-utils";

// Language loader cache
const langCache = new Map<string, Extension>();

async function loadLanguage(lang: string): Promise<Extension | null> {
  if (langCache.has(lang)) return langCache.get(lang)!;

  let ext: Extension | null = null;
  try {
    switch (lang) {
      case "javascript": {
        const { javascript: jsLang } = await import("@codemirror/lang-javascript");
        // Provide both JS and TS support
        ext = jsLang({ jsx: true, typescript: true });
        langCache.set(lang, ext);
        // Also cache TS variant
        langCache.set("typescript", ext);
        break;
      }
      case "html": {
        const { html } = await import("@codemirror/lang-html");
        ext = html({ matchClosingTags: true, autoCloseTags: true });
        break;
      }
      case "css": {
        const { css } = await import("@codemirror/lang-css");
        ext = css();
        break;
      }
      case "json": {
        const { json } = await import("@codemirror/lang-json");
        ext = json();
        break;
      }
      case "markdown": {
        const { markdown: mdLang } = await import("@codemirror/lang-markdown");
        ext = mdLang();
        break;
      }
      case "python": {
        const { python } = await import("@codemirror/lang-python");
        ext = python();
        break;
      }
      case "rust": {
        const { rust } = await import("@codemirror/lang-rust");
        ext = rust();
        break;
      }
      case "java": {
        const { java } = await import("@codemirror/lang-java");
        ext = java();
        break;
      }
      case "cpp": {
        const { cpp } = await import("@codemirror/lang-cpp");
        ext = cpp();
        break;
      }
      case "xml": {
        const { xml } = await import("@codemirror/lang-xml");
        ext = xml();
        break;
      }
      case "sql": {
        const { sql: sqlLang } = await import("@codemirror/lang-sql");
        ext = sqlLang();
        break;
      }
      case "php": {
        const { php } = await import("@codemirror/lang-php");
        ext = php();
        break;
      }
      case "go": {
        const { go } = await import("@codemirror/lang-go");
        ext = go();
        break;
      }
      case "yaml": {
        const { yaml } = await import("@codemirror/lang-yaml");
        ext = yaml();
        break;
      }
      case "wast": {
        const { wast } = await import("@codemirror/lang-wast");
        ext = wast();
        break;
      }
      default:
        return null;
    }
  } catch {
    return null;
  }

  if (ext) langCache.set(lang, ext);
  return ext;
}

// JSON linter
async function getJsonLinter(): Promise<Extension | null> {
  try {
    const { linter } = await import("@codemirror/lint");
    const { jsonParseLinter } = await import("@codemirror/lang-json");
    return linter(jsonParseLinter());
  } catch {
    return null;
  }
}

interface CodeEditorProps {
  content: string;
  filename: string;
  readOnly?: boolean;
  onChange?: (content: string) => void;
  onSave?: (content: string) => void;
}

export default function CodeEditor({
  content,
  filename,
  readOnly = false,
  onChange,
  onSave,
}: CodeEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const [loading, setLoading] = useState(true);
  const onChangeRef = useRef(onChange);
  const onSaveRef = useRef(onSave);
  onChangeRef.current = onChange;
  onSaveRef.current = onSave;

  // Store content for comparison
  const contentRef = useRef(content);

  useEffect(() => {
    if (!containerRef.current) return;

    let destroyed = false;

    const setup = async () => {
      const lang = getLanguageForFile(filename);
      const extensions: Extension[] = [
        lineNumbers(),
        highlightActiveLineGutter(),
        highlightSpecialChars(),
        history(),
        foldGutter(),
        drawSelection(),
        dropCursor(),
        EditorState.allowMultipleSelections.of(true),
        indentOnInput(),
        syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
        bracketMatching(),
        closeBrackets(),
        autocompletion(),
        rectangularSelection(),
        crosshairCursor(),
        highlightActiveLine(),
        highlightSelectionMatches(),
        keymap.of([
          ...closeBracketsKeymap,
          ...defaultKeymap,
          ...searchKeymap,
          ...historyKeymap,
          ...foldKeymap,
          ...completionKeymap,
          ...lintKeymap,
          indentWithTab,
        ]),
        cmTheme,
        cmHighlighting,
      ];

      // Load language support
      if (lang) {
        const langExt = await loadLanguage(lang);
        if (langExt && !destroyed) extensions.push(langExt);
      }

      // JSON linter
      if (lang === "json") {
        const jsonLint = await getJsonLinter();
        if (jsonLint && !destroyed) extensions.push(jsonLint);
      }

      // Read-only mode
      if (readOnly) {
        extensions.push(EditorState.readOnly.of(true));
        extensions.push(EditorView.editable.of(false));
      }

      // Change listener
      extensions.push(
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            const newContent = update.state.doc.toString();
            onChangeRef.current?.(newContent);
          }
        })
      );

      // Ctrl+S handler
      extensions.push(
        keymap.of([
          {
            key: "Mod-s",
            run: (view) => {
              onSaveRef.current?.(view.state.doc.toString());
              return true;
            },
          },
        ])
      );

      if (destroyed) return;

      const state = EditorState.create({
        doc: content,
        extensions,
      });

      const view = new EditorView({
        state,
        parent: containerRef.current!,
      });

      viewRef.current = view;
      contentRef.current = content;
      setLoading(false);
    };

    setup();

    return () => {
      destroyed = true;
      if (viewRef.current) {
        viewRef.current.destroy();
        viewRef.current = null;
      }
    };
    // Only re-create editor when filename changes (new file opened)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filename, readOnly]);

  // Update content when it changes externally (e.g., reload after conflict)
  useEffect(() => {
    if (viewRef.current && content !== contentRef.current) {
      const view = viewRef.current;
      const currentContent = view.state.doc.toString();
      if (content !== currentContent) {
        view.dispatch({
          changes: { from: 0, to: view.state.doc.length, insert: content },
        });
      }
      contentRef.current = content;
    }
  }, [content]);

  return (
    <div className="relative w-full h-full overflow-hidden">
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-surface-alt z-10">
          <div className="animate-spin h-6 w-6 border-2 border-accent border-t-transparent rounded-full" />
        </div>
      )}
      <div ref={containerRef} className="w-full h-full cm-editor-container" />
    </div>
  );
}

/**
 * Get the current content from the editor view.
 */
export function getEditorContent(view: EditorView): string {
  return view.state.doc.toString();
}

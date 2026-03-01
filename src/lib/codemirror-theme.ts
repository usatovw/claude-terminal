import { EditorView } from "@codemirror/view";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags } from "@lezer/highlight";

/**
 * CodeMirror 6 theme that uses CSS custom properties (--th-*) from globals.css.
 * Automatically adapts to both Dark Violet and Retro OS themes.
 */
export const cmTheme = EditorView.theme({
  "&": {
    color: "var(--th-fg)",
    backgroundColor: "var(--th-surface-alt)",
    fontSize: "14px",
    fontFamily: "var(--th-font-mono)",
  },
  ".cm-content": {
    caretColor: "var(--th-accent-fg)",
    padding: "8px 0",
  },
  ".cm-cursor, .cm-dropCursor": {
    borderLeftColor: "var(--th-accent-fg)",
  },
  "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection": {
    backgroundColor: "var(--th-accent-muted)",
  },
  ".cm-panels": {
    backgroundColor: "var(--th-surface)",
    color: "var(--th-fg)",
  },
  ".cm-panels.cm-panels-top": {
    borderBottom: "1px solid var(--th-border)",
  },
  ".cm-panels.cm-panels-bottom": {
    borderTop: "1px solid var(--th-border)",
  },
  ".cm-searchMatch": {
    backgroundColor: "rgba(255, 200, 0, 0.25)",
    outline: "1px solid rgba(255, 200, 0, 0.4)",
  },
  ".cm-searchMatch.cm-searchMatch-selected": {
    backgroundColor: "rgba(255, 200, 0, 0.4)",
  },
  ".cm-activeLine": {
    backgroundColor: "var(--th-surface-hover)",
  },
  ".cm-selectionMatch": {
    backgroundColor: "rgba(139, 92, 246, 0.15)",
  },
  "&.cm-focused .cm-matchingBracket, &.cm-focused .cm-nonmatchingBracket": {
    backgroundColor: "rgba(139, 92, 246, 0.25)",
    outline: "1px solid rgba(139, 92, 246, 0.4)",
  },
  ".cm-gutters": {
    backgroundColor: "var(--th-surface)",
    color: "var(--th-muted)",
    border: "none",
    borderRight: "1px solid var(--th-border)",
  },
  ".cm-activeLineGutter": {
    backgroundColor: "var(--th-surface-hover)",
    color: "var(--th-muted-fg)",
  },
  ".cm-foldPlaceholder": {
    backgroundColor: "var(--th-surface-alt)",
    border: "1px solid var(--th-border)",
    color: "var(--th-muted-fg)",
  },
  ".cm-tooltip": {
    border: "1px solid var(--th-border-strong)",
    backgroundColor: "var(--th-surface)",
    color: "var(--th-fg)",
  },
  ".cm-tooltip .cm-tooltip-arrow:before": {
    borderTopColor: "var(--th-border-strong)",
    borderBottomColor: "var(--th-border-strong)",
  },
  ".cm-tooltip .cm-tooltip-arrow:after": {
    borderTopColor: "var(--th-surface)",
    borderBottomColor: "var(--th-surface)",
  },
  ".cm-tooltip-autocomplete": {
    "& > ul > li[aria-selected]": {
      backgroundColor: "var(--th-accent-muted)",
      color: "var(--th-fg)",
    },
  },
  // Search/replace panel
  ".cm-panel.cm-search": {
    padding: "4px 8px",
    "& input, & button, & label": {
      fontSize: "13px",
    },
    "& input": {
      backgroundColor: "var(--th-surface-alt)",
      color: "var(--th-fg)",
      border: "1px solid var(--th-border-strong)",
      borderRadius: "4px",
      padding: "2px 6px",
    },
    "& button": {
      backgroundColor: "var(--th-surface-hover)",
      color: "var(--th-fg)",
      border: "1px solid var(--th-border)",
      borderRadius: "4px",
      padding: "2px 8px",
      cursor: "pointer",
    },
    "& button:hover": {
      backgroundColor: "var(--th-accent-muted)",
    },
    "& label": {
      color: "var(--th-muted-fg)",
    },
  },
  // Lint markers
  ".cm-lintRange-error": {
    backgroundImage: "none",
    textDecoration: "underline wavy var(--th-danger)",
  },
  ".cm-lintRange-warning": {
    backgroundImage: "none",
    textDecoration: "underline wavy var(--th-warning)",
  },
  ".cm-diagnostic-error": {
    borderLeft: "3px solid var(--th-danger)",
  },
  ".cm-diagnostic-warning": {
    borderLeft: "3px solid var(--th-warning)",
  },
}, { dark: true });

/**
 * Syntax highlighting that uses CSS custom properties.
 */
export const cmHighlighting = syntaxHighlighting(HighlightStyle.define([
  // Keywords — VS Code: blue (#569CD6 dark, #0000FF light)
  { tag: tags.keyword, color: "var(--th-syntax-keyword)" },
  { tag: tags.definitionKeyword, color: "var(--th-syntax-keyword)" },
  // Control flow — VS Code: magenta (#C586C0 dark, #AF00DB light)
  { tag: tags.controlKeyword, color: "var(--th-syntax-control)" },
  { tag: tags.moduleKeyword, color: "var(--th-syntax-control)" },
  // Operators
  { tag: tags.operator, color: "var(--th-syntax-operator)" },
  { tag: tags.derefOperator, color: "var(--th-syntax-punctuation)" },
  // Strings — VS Code: #CE9178 dark, #A31515 light
  { tag: tags.string, color: "var(--th-syntax-string)" },
  { tag: tags.special(tags.string), color: "var(--th-syntax-string)" },
  // Regex — VS Code: #D16969 dark, #811F3F light
  { tag: tags.regexp, color: "var(--th-syntax-regexp)" },
  // Comments — VS Code: #6A9955 dark, #008000 light
  { tag: tags.comment, color: "var(--th-syntax-comment)", fontStyle: "italic" },
  { tag: tags.lineComment, color: "var(--th-syntax-comment)", fontStyle: "italic" },
  { tag: tags.blockComment, color: "var(--th-syntax-comment)", fontStyle: "italic" },
  { tag: tags.docComment, color: "var(--th-syntax-comment)", fontStyle: "italic" },
  // Numbers — VS Code: #B5CEA8 dark, #098658 light
  { tag: tags.number, color: "var(--th-syntax-number)" },
  { tag: tags.integer, color: "var(--th-syntax-number)" },
  { tag: tags.float, color: "var(--th-syntax-number)" },
  // Booleans & null — VS Code: #569CD6 dark, #0000FF light
  { tag: tags.bool, color: "var(--th-syntax-bool)" },
  { tag: tags.null, color: "var(--th-syntax-bool)" },
  { tag: tags.atom, color: "var(--th-syntax-bool)" },
  // Variables — VS Code: #9CDCFE dark, #001080 light
  { tag: tags.variableName, color: "var(--th-syntax-variable)" },
  { tag: tags.definition(tags.variableName), color: "var(--th-syntax-variable)" },
  // Functions — VS Code: #DCDCAA dark, #795E26 light
  { tag: tags.function(tags.variableName), color: "var(--th-syntax-fn)" },
  { tag: tags.function(tags.propertyName), color: "var(--th-syntax-fn)" },
  // Types & classes — VS Code: #4EC9B0 dark, #267F99 light
  { tag: tags.typeName, color: "var(--th-syntax-type)" },
  { tag: tags.className, color: "var(--th-syntax-type)" },
  { tag: tags.namespace, color: "var(--th-syntax-type)" },
  // Properties — VS Code: #9CDCFE dark, #001080 light
  { tag: tags.propertyName, color: "var(--th-syntax-property)" },
  { tag: tags.definition(tags.propertyName), color: "var(--th-syntax-property)" },
  // HTML/XML tags — VS Code: #569CD6 dark, #800000 light
  { tag: tags.tagName, color: "var(--th-syntax-tag)" },
  // HTML attributes — VS Code: #9CDCFE dark, #FF0000 light
  { tag: tags.attributeName, color: "var(--th-syntax-attr)" },
  { tag: tags.attributeValue, color: "var(--th-syntax-string)" },
  // Meta/preprocessor
  { tag: tags.meta, color: "var(--th-syntax-keyword)" },
  // Labels & self
  { tag: tags.labelName, color: "var(--th-syntax-control)" },
  { tag: tags.self, color: "var(--th-syntax-keyword)", fontStyle: "italic" },
  // Punctuation
  { tag: tags.punctuation, color: "var(--th-syntax-punctuation)" },
  // Markdown
  { tag: tags.heading, color: "var(--th-syntax-keyword)", fontWeight: "bold" },
  { tag: tags.link, color: "var(--th-syntax-fn)", textDecoration: "underline" },
  { tag: tags.emphasis, fontStyle: "italic" },
  { tag: tags.strong, fontWeight: "bold" },
  { tag: tags.strikethrough, textDecoration: "line-through" },
  // Diff
  { tag: tags.inserted, color: "var(--th-success)" },
  { tag: tags.deleted, color: "var(--th-danger)" },
  { tag: tags.changed, color: "var(--th-syntax-number)" },
  { tag: tags.invalid, color: "var(--th-danger)" },
]));

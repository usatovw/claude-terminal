"use client";

import { useMemo, useState, useCallback } from "react";

interface DataPreviewProps {
  content: string;
  type: "json" | "csv";
}

export default function DataPreview({ content, type }: DataPreviewProps) {
  if (type === "json") return <JsonTree content={content} />;
  if (type === "csv") return <CsvTable content={content} />;
  return null;
}

// ─── JSON Tree ──────────────────────────────────────────────────────────────

function JsonTree({ content }: { content: string }) {
  const parsed = useMemo(() => {
    try {
      return { data: JSON.parse(content), error: null };
    } catch (e) {
      return { data: null, error: (e as Error).message };
    }
  }, [content]);

  if (parsed.error) {
    return (
      <div className="h-full overflow-auto p-4">
        <p className="text-danger text-sm">JSON Error: {parsed.error}</p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto p-4 font-mono text-sm">
      <JsonNode value={parsed.data} depth={0} />
    </div>
  );
}

function JsonNode({ value, depth, keyName }: { value: unknown; depth: number; keyName?: string }) {
  const [collapsed, setCollapsed] = useState(depth > 2);

  const toggle = useCallback(() => setCollapsed((c) => !c), []);

  const indent = depth * 16;
  const prefix = keyName !== undefined ? (
    <span className="text-accent-fg">&quot;{keyName}&quot;</span>
  ) : null;
  const colon = prefix ? <span className="text-muted-fg">: </span> : null;

  if (value === null) {
    return (
      <div style={{ paddingLeft: indent }}>
        {prefix}{colon}<span className="text-muted-fg italic">null</span>
      </div>
    );
  }

  if (typeof value === "boolean") {
    return (
      <div style={{ paddingLeft: indent }}>
        {prefix}{colon}<span className="text-warning">{value ? "true" : "false"}</span>
      </div>
    );
  }

  if (typeof value === "number") {
    return (
      <div style={{ paddingLeft: indent }}>
        {prefix}{colon}<span className="text-warning">{String(value)}</span>
      </div>
    );
  }

  if (typeof value === "string") {
    return (
      <div style={{ paddingLeft: indent }}>
        {prefix}{colon}<span className="text-success">&quot;{value.length > 200 ? value.slice(0, 200) + "…" : value}&quot;</span>
      </div>
    );
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return (
        <div style={{ paddingLeft: indent }}>
          {prefix}{colon}<span className="text-muted-fg">[]</span>
        </div>
      );
    }
    return (
      <div>
        <div
          style={{ paddingLeft: indent }}
          onClick={toggle}
          className="cursor-pointer hover:bg-surface-hover rounded select-none py-px"
        >
          <span className="text-muted-fg inline-block w-4 text-center">{collapsed ? "▶" : "▼"}</span>
          {prefix}{colon}
          <span className="text-muted-fg">{collapsed ? `Array [${value.length}]` : "["}</span>
        </div>
        {!collapsed && (
          <>
            {value.map((item, i) => (
              <JsonNode key={i} value={item} depth={depth + 1} />
            ))}
            <div style={{ paddingLeft: indent }}>
              <span className="text-muted-fg ml-4">]</span>
            </div>
          </>
        )}
      </div>
    );
  }

  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) {
      return (
        <div style={{ paddingLeft: indent }}>
          {prefix}{colon}<span className="text-muted-fg">{"{}"}</span>
        </div>
      );
    }
    return (
      <div>
        <div
          style={{ paddingLeft: indent }}
          onClick={toggle}
          className="cursor-pointer hover:bg-surface-hover rounded select-none py-px"
        >
          <span className="text-muted-fg inline-block w-4 text-center">{collapsed ? "▶" : "▼"}</span>
          {prefix}{colon}
          <span className="text-muted-fg">{collapsed ? `Object {${entries.length}}` : "{"}</span>
        </div>
        {!collapsed && (
          <>
            {entries.map(([k, v]) => (
              <JsonNode key={k} value={v} depth={depth + 1} keyName={k} />
            ))}
            <div style={{ paddingLeft: indent }}>
              <span className="text-muted-fg ml-4">{"}"}</span>
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <div style={{ paddingLeft: indent }}>
      {prefix}{colon}<span className="text-foreground">{String(value)}</span>
    </div>
  );
}

// ─── CSV Table ──────────────────────────────────────────────────────────────

function CsvTable({ content }: { content: string }) {
  const { headers, rows } = useMemo(() => {
    const lines = content.split(/\r?\n/).filter((l) => l.trim());
    if (lines.length === 0) return { headers: [] as string[], rows: [] as string[][] };

    const delimiter = content.includes("\t") ? "\t" : ",";
    const parse = (line: string) => {
      const result: string[] = [];
      let current = "";
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
          if (inQuotes && line[i + 1] === '"') {
            current += '"';
            i++;
          } else {
            inQuotes = !inQuotes;
          }
        } else if (ch === delimiter && !inQuotes) {
          result.push(current.trim());
          current = "";
        } else {
          current += ch;
        }
      }
      result.push(current.trim());
      return result;
    };

    const h = parse(lines[0]);
    const r = lines.slice(1, 101).map(parse); // Limit to 100 rows
    return { headers: h, rows: r };
  }, [content]);

  if (headers.length === 0) {
    return (
      <div className="h-full overflow-auto p-4">
        <p className="text-muted-fg text-sm">Пустой CSV</p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto p-2">
      <table className="md-viewer w-full border-collapse text-sm">
        <thead>
          <tr>
            {headers.map((h, i) => (
              <th key={i}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri}>
              {headers.map((_, ci) => (
                <td key={ci}>{row[ci] ?? ""}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length >= 100 && (
        <p className="text-xs text-muted-fg mt-2 text-center">Показаны первые 100 строк</p>
      )}
    </div>
  );
}

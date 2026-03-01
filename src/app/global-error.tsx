"use client";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html>
      <body style={{ background: "#0a0a0a", color: "#e4e4e7", fontFamily: "system-ui, sans-serif" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", flexDirection: "column", gap: "16px" }}>
          <h2 style={{ fontSize: "1.25rem" }}>Что-то пошло не так</h2>
          <button
            onClick={reset}
            style={{ padding: "8px 16px", background: "#8b5cf6", color: "#fff", border: "none", borderRadius: "8px", cursor: "pointer" }}
          >
            Попробовать снова
          </button>
        </div>
      </body>
    </html>
  );
}

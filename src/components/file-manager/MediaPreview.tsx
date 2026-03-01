"use client";

import { useMemo } from "react";

interface MediaPreviewProps {
  type: "image" | "svg";
  content?: string;
  sessionId: string;
  filePath: string;
}

function sanitizeSvg(svg: string): string {
  // Remove <script> tags and event handlers
  return svg
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/\bon\w+\s*=\s*["'][^"']*["']/gi, "");
}

export default function MediaPreview({ type, content, sessionId, filePath }: MediaPreviewProps) {
  const sanitizedSvg = useMemo(() => {
    if (type === "svg" && content) return sanitizeSvg(content);
    return "";
  }, [type, content]);

  if (type === "svg" && sanitizedSvg) {
    return (
      <div className="h-full w-full flex items-center justify-center p-4 overflow-auto">
        <div
          className="max-w-full max-h-full"
          dangerouslySetInnerHTML={{ __html: sanitizedSvg }}
        />
      </div>
    );
  }

  // Image via download endpoint
  const imgSrc = `/api/sessions/${sessionId}/files/download?path=${encodeURIComponent(filePath)}`;

  return (
    <div className="h-full w-full flex items-center justify-center p-4 overflow-auto bg-[repeating-conic-gradient(var(--th-surface-hover)_0%_25%,var(--th-surface-alt)_0%_50%)] bg-[length:20px_20px]">
      <img
        src={imgSrc}
        alt={filePath.split("/").pop() || "image"}
        className="max-w-full max-h-full object-contain rounded"
        loading="lazy"
      />
    </div>
  );
}

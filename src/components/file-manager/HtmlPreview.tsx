"use client";

import { useMemo, useRef, useEffect } from "react";

interface HtmlPreviewProps {
  content: string;
}

export default function HtmlPreview({ content }: HtmlPreviewProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounce iframe updates
  const debouncedContent = useMemo(() => content, [content]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (iframeRef.current) {
        iframeRef.current.srcdoc = debouncedContent;
      }
    }, 500);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [debouncedContent]);

  return (
    <div className="h-full w-full bg-white rounded overflow-hidden">
      <iframe
        ref={iframeRef}
        sandbox="allow-scripts"
        srcDoc={content}
        className="w-full h-full border-0"
        title="HTML Preview"
      />
    </div>
  );
}

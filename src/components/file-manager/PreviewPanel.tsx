"use client";

import { type PreviewType } from "@/lib/editor-utils";
import MarkdownPreview from "./MarkdownPreview";
import HtmlPreview from "./HtmlPreview";
import MediaPreview from "./MediaPreview";
import DataPreview from "./DataPreview";

interface PreviewPanelProps {
  content: string;
  previewType: PreviewType;
  sessionId: string;
  filePath: string;
  onNavigate?: (path: string, name: string) => void;
}

export default function PreviewPanel({
  content,
  previewType,
  sessionId,
  filePath,
  onNavigate,
}: PreviewPanelProps) {
  if (!previewType) return null;

  switch (previewType) {
    case "markdown":
      return <MarkdownPreview content={content} filePath={filePath} onNavigate={onNavigate} />;
    case "html":
      return <HtmlPreview content={content} />;
    case "image":
      return <MediaPreview type="image" sessionId={sessionId} filePath={filePath} />;
    case "svg":
      return <MediaPreview type="svg" content={content} sessionId={sessionId} filePath={filePath} />;
    case "json":
      return <DataPreview content={content} type="json" />;
    case "csv":
      return <DataPreview content={content} type="csv" />;
    default:
      return null;
  }
}

"use client";

import { PRESENCE_COLORS } from "@/lib/presence-colors";
import { renderMarkdown } from "@/lib/markdown";
import { formatFileSize } from "@/lib/utils";
import { FileIcon, Download } from "@/components/Icons";

export interface ChatMessageData {
  id: number;
  text: string;
  createdAt: string;
  user: {
    id: number;
    login: string;
    firstName: string;
    lastName: string;
    role: string;
    colorIndex: number;
  };
  attachments: Array<{
    id: number;
    filePath: string;
    originalName: string;
    mimeType: string;
    size: number;
  }>;
}

interface ChatMessageProps {
  message: ChatMessageData;
  onImageClick?: (src: string) => void;
}

export default function ChatMessage({ message, onImageClick }: ChatMessageProps) {
  const { user, text, createdAt, attachments } = message;
  const color = PRESENCE_COLORS[user.colorIndex % PRESENCE_COLORS.length];
  const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ");
  const initial = fullName.charAt(0).toUpperCase();

  // Format time HH:MM
  const date = new Date(createdAt + "Z");
  const time = date.toLocaleTimeString("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const imageAttachments = attachments.filter((a) =>
    a.mimeType.startsWith("image/")
  );
  const fileAttachments = attachments.filter(
    (a) => !a.mimeType.startsWith("image/")
  );

  return (
    <div className="flex gap-2.5 px-3 py-1.5 group hover:bg-zinc-900/30 transition-colors">
      {/* Avatar */}
      <div
        className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-white text-xs font-medium ${color.bg}`}
      >
        {initial}
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        {/* Header: name + time */}
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-medium" style={{ color: color.cursor }}>
            {fullName}
          </span>
          <span className="text-[10px] text-zinc-600 opacity-0 group-hover:opacity-100 transition-opacity">
            {time}
          </span>
        </div>

        {/* Text */}
        {text && (
          <div
            className="text-sm text-zinc-300 leading-relaxed mt-0.5 break-words"
            dangerouslySetInnerHTML={{ __html: renderMarkdown(text) }}
          />
        )}

        {/* Image attachments */}
        {imageAttachments.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {imageAttachments.map((att) => (
              <button
                key={att.id}
                onClick={() =>
                  onImageClick?.(`/api/chat/uploads/${att.filePath}`)
                }
                className="block rounded-lg overflow-hidden border border-zinc-800/50 hover:border-zinc-700 transition-colors cursor-pointer"
              >
                <img
                  src={`/api/chat/uploads/${att.filePath}`}
                  alt={att.originalName}
                  className="max-w-[240px] max-h-[180px] object-cover"
                  loading="lazy"
                />
              </button>
            ))}
          </div>
        )}

        {/* File attachments */}
        {fileAttachments.length > 0 && (
          <div className="flex flex-col gap-1.5 mt-2">
            {fileAttachments.map((att) => (
              <a
                key={att.id}
                href={`/api/chat/uploads/${att.filePath}`}
                download={att.originalName}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-zinc-900/50 border border-zinc-800/50 hover:border-zinc-700 transition-colors group/file max-w-[280px]"
              >
                <FileIcon className="w-4 h-4 text-zinc-500 flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="text-xs text-zinc-300 truncate">
                    {att.originalName}
                  </div>
                  <div className="text-[10px] text-zinc-600">
                    {formatFileSize(att.size)}
                  </div>
                </div>
                <Download className="w-3.5 h-3.5 text-zinc-600 group-hover/file:text-zinc-400 transition-colors flex-shrink-0" />
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

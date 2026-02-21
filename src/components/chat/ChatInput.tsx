"use client";

import { useState, useRef, useCallback } from "react";
import { X } from "@/components/Icons";

interface PendingFile {
  file: File;
  preview?: string; // data URL for images
}

interface ChatInputProps {
  disabled?: boolean;
  disabledTooltip?: string;
  onSend: (text: string, files: File[]) => void;
}

export default function ChatInput({
  disabled,
  disabledTooltip,
  onSend,
}: ChatInputProps) {
  const [text, setText] = useState("");
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const hasContent = text.trim().length > 0 || pendingFiles.length > 0;

  const handleSubmit = useCallback(() => {
    if (!hasContent || disabled) return;
    onSend(text, pendingFiles.map((pf) => pf.file));
    setText("");
    setPendingFiles([]);
    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }, [text, pendingFiles, hasContent, disabled, onSend]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
    // Auto-grow up to ~4 lines
    const ta = e.target;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 96) + "px";
  };

  const addFiles = (files: FileList | File[]) => {
    const newFiles: PendingFile[] = [];
    for (const file of Array.from(files)) {
      const pf: PendingFile = { file };
      if (file.type.startsWith("image/")) {
        pf.preview = URL.createObjectURL(file);
      }
      newFiles.push(pf);
    }
    setPendingFiles((prev) => [...prev, ...newFiles]);
  };

  const removeFile = (index: number) => {
    setPendingFiles((prev) => {
      const removed = prev[index];
      if (removed.preview) URL.revokeObjectURL(removed.preview);
      return prev.filter((_, i) => i !== index);
    });
  };

  const handleFileInput = () => {
    fileInputRef.current?.click();
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    const imageFiles: File[] = [];
    for (const item of Array.from(items)) {
      if (item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (file) imageFiles.push(file);
      }
    }
    if (imageFiles.length > 0) {
      e.preventDefault();
      addFiles(imageFiles);
    }
  };

  return (
    <div className="border-t border-zinc-800/50 bg-zinc-950/90">
      {/* Pending files preview */}
      {pendingFiles.length > 0 && (
        <div className="flex gap-2 px-3 pt-2 pb-1 overflow-x-auto">
          {pendingFiles.map((pf, i) => (
            <div
              key={i}
              className="relative flex-shrink-0 rounded-lg border border-zinc-800/50 overflow-hidden group"
            >
              {pf.preview ? (
                <img
                  src={pf.preview}
                  alt={pf.file.name}
                  className="w-16 h-16 object-cover"
                />
              ) : (
                <div className="w-16 h-16 bg-zinc-900 flex items-center justify-center text-[10px] text-zinc-500 px-1 text-center">
                  {pf.file.name.split(".").pop()?.toUpperCase()}
                </div>
              )}
              <button
                onClick={() => removeFile(i)}
                className="absolute top-0.5 right-0.5 w-4 h-4 bg-zinc-900/90 rounded-full flex items-center justify-center text-zinc-400 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Input area */}
      <div className="flex items-end gap-2 px-3 py-2" title={disabled ? disabledTooltip : undefined}>
        {/* Attach button */}
        <button
          onClick={handleFileInput}
          disabled={disabled}
          className="p-1.5 text-zinc-500 hover:text-zinc-300 transition-colors flex-shrink-0 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
          title="Прикрепить файл"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48" />
          </svg>
        </button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/jpeg,image/png,image/gif,image/webp,.pdf,.doc,.docx,.txt,.zip"
          className="hidden"
          onChange={(e) => {
            if (e.target.files) addFiles(e.target.files);
            e.target.value = "";
          }}
        />

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={text}
          onChange={handleTextChange}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          disabled={disabled}
          placeholder={disabled ? disabledTooltip : "Сообщение..."}
          rows={1}
          className="flex-1 bg-transparent text-sm text-zinc-200 placeholder-zinc-600 outline-none resize-none max-h-24 min-h-[20px] disabled:opacity-30 disabled:cursor-not-allowed"
        />

        {/* Send button */}
        <button
          onClick={handleSubmit}
          disabled={!hasContent || disabled}
          className="p-1.5 text-violet-400 hover:text-violet-300 transition-colors flex-shrink-0 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
          title="Отправить"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
          </svg>
        </button>
      </div>
    </div>
  );
}

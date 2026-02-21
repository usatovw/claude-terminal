"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { formatFileSize } from "@/lib/utils";
import { FileIcon, Download } from "@/components/Icons";

type GalleryTab = "images" | "files";

interface MediaItem {
  id: number;
  filePath: string;
  originalName: string;
  mimeType: string;
  size: number;
  createdAt: string;
  user: {
    id: number;
    login: string;
    firstName: string;
    lastName: string;
    colorIndex: number;
  };
}

interface MediaGalleryProps {
  onImageClick?: (src: string) => void;
  onBack: () => void;
}

export default function MediaGallery({ onImageClick, onBack }: MediaGalleryProps) {
  const [tab, setTab] = useState<GalleryTab>("images");
  const [items, setItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  const fetchMedia = useCallback(
    async (offset = 0, append = false) => {
      if (offset === 0) setLoading(true);
      else setLoadingMore(true);

      try {
        const res = await fetch(
          `/api/chat/media?type=${tab}&offset=${offset}&limit=30`
        );
        if (res.ok) {
          const data = await res.json();
          if (append) {
            setItems((prev) => [...prev, ...data.media]);
          } else {
            setItems(data.media);
          }
          setHasMore(data.media.length >= 30);
        }
      } catch {
        // Ignore
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [tab]
  );

  useEffect(() => {
    setItems([]);
    setHasMore(true);
    fetchMedia(0, false);
  }, [fetchMedia]);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el || loadingMore || !hasMore) return;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 200) {
      fetchMedia(items.length, true);
    }
  }, [loadingMore, hasMore, items.length, fetchMedia]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="h-12 flex items-center gap-3 px-4 border-b border-zinc-800/50 flex-shrink-0">
        <button
          onClick={onBack}
          className="p-1 text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="m12 19-7-7 7-7" />
            <path d="M19 12H5" />
          </svg>
        </button>
        <span className="text-sm font-medium text-zinc-300">Медиа</span>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 px-3 py-2 border-b border-zinc-800/50">
        {(["images", "files"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer ${
              tab === t
                ? "bg-zinc-800 text-white"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            {t === "images" ? "Фото" : "Файлы"}
          </button>
        ))}
      </div>

      {/* Content */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto"
      >
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin h-6 w-6 border-2 border-violet-500 border-t-transparent rounded-full" />
          </div>
        ) : items.length === 0 ? (
          <div className="flex items-center justify-center h-32">
            <p className="text-zinc-600 text-sm">
              {tab === "images" ? "Нет фото" : "Нет файлов"}
            </p>
          </div>
        ) : tab === "images" ? (
          /* Image grid — 3 columns */
          <div className="grid grid-cols-3 gap-0.5 p-0.5">
            {items.map((item) => (
              <button
                key={item.id}
                onClick={() =>
                  onImageClick?.(`/api/chat/uploads/${item.filePath}`)
                }
                className="aspect-square overflow-hidden bg-zinc-900 hover:opacity-80 transition-opacity cursor-pointer"
              >
                <img
                  src={`/api/chat/uploads/${item.filePath}`}
                  alt={item.originalName}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              </button>
            ))}
          </div>
        ) : (
          /* File list */
          <div className="p-2 space-y-1">
            {items.map((item) => (
              <a
                key={item.id}
                href={`/api/chat/uploads/${item.filePath}`}
                download={item.originalName}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-zinc-900/50 transition-colors group"
              >
                <FileIcon className="w-5 h-5 text-zinc-500 flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="text-sm text-zinc-300 truncate">
                    {item.originalName}
                  </div>
                  <div className="text-[10px] text-zinc-600">
                    {formatFileSize(item.size)} &middot;{" "}
                    {[item.user.firstName, item.user.lastName]
                      .filter(Boolean)
                      .join(" ")}
                  </div>
                </div>
                <Download className="w-4 h-4 text-zinc-600 group-hover:text-zinc-400 transition-colors flex-shrink-0" />
              </a>
            ))}
          </div>
        )}

        {loadingMore && (
          <div className="flex justify-center py-3">
            <div className="animate-spin h-4 w-4 border-2 border-zinc-600 border-t-zinc-400 rounded-full" />
          </div>
        )}
      </div>
    </div>
  );
}

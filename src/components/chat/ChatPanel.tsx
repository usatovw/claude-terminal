"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { usePresence } from "@/components/presence/PresenceProvider";
import { useUser } from "@/lib/UserContext";
import ChatMessage, { type ChatMessageData } from "./ChatMessage";
import ChatInput from "./ChatInput";
import DateSeparator, { shouldShowDateSeparator } from "./DateSeparator";
import MediaGallery from "./MediaGallery";

interface ChatPanelProps {
  onImageClick?: (src: string) => void;
}

export default function ChatPanel({ onImageClick }: ChatPanelProps) {
  const [showGallery, setShowGallery] = useState(false);

  if (showGallery) {
    return (
      <MediaGallery
        onImageClick={onImageClick}
        onBack={() => setShowGallery(false)}
      />
    );
  }

  return (
    <ChatPanelMessages
      onImageClick={onImageClick}
      onToggleGallery={() => setShowGallery(true)}
    />
  );
}

function ChatPanelMessages({
  onImageClick,
  onToggleGallery,
}: {
  onImageClick?: (src: string) => void;
  onToggleGallery: () => void;
}) {
  const { isGuest } = useUser();
  const { globalChatMessages } = usePresence();
  const [messages, setMessages] = useState<ChatMessageData[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const isAtBottomRef = useRef(true);
  const initialLoadDone = useRef(false);

  // Load initial messages
  useEffect(() => {
    fetchMessages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchMessages = async () => {
    try {
      const res = await fetch("/api/chat/messages?limit=50");
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages);
        setHasMore(data.messages.length >= 50);
      }
    } catch {
      // Ignore
    } finally {
      setLoading(false);
      // Scroll to bottom after initial load
      requestAnimationFrame(() => {
        if (scrollRef.current) {
          scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
        initialLoadDone.current = true;
      });
    }
  };

  // Load older messages (infinite scroll up)
  const loadOlder = useCallback(async () => {
    if (loadingOlder || !hasMore || messages.length === 0) return;
    setLoadingOlder(true);

    const oldestId = messages[0]?.id;
    const scrollEl = scrollRef.current;
    const prevScrollHeight = scrollEl?.scrollHeight || 0;

    try {
      const res = await fetch(`/api/chat/messages?before=${oldestId}&limit=50`);
      if (res.ok) {
        const data = await res.json();
        if (data.messages.length === 0) {
          setHasMore(false);
        } else {
          setMessages((prev) => [...data.messages, ...prev]);
          setHasMore(data.messages.length >= 50);
          // Preserve scroll position
          requestAnimationFrame(() => {
            if (scrollEl) {
              scrollEl.scrollTop = scrollEl.scrollHeight - prevScrollHeight;
            }
          });
        }
      }
    } catch {
      // Ignore
    } finally {
      setLoadingOlder(false);
    }
  }, [loadingOlder, hasMore, messages]);

  // Handle scroll — detect top (load older) and bottom (auto-scroll)
  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;

    // Check if at bottom (with 50px tolerance)
    isAtBottomRef.current =
      el.scrollHeight - el.scrollTop - el.clientHeight < 50;

    // Load older when scrolled to top
    if (el.scrollTop < 100 && hasMore && !loadingOlder) {
      loadOlder();
    }
  }, [hasMore, loadingOlder, loadOlder]);

  // Handle real-time messages via WS
  useEffect(() => {
    if (!globalChatMessages || globalChatMessages.length === 0) return;
    const latest = globalChatMessages[globalChatMessages.length - 1];

    setMessages((prev) => {
      // Deduplicate by id
      if (prev.some((m) => m.id === latest.id)) return prev;
      return [...prev, latest];
    });

    // Auto-scroll if at bottom
    if (isAtBottomRef.current) {
      requestAnimationFrame(() => {
        if (scrollRef.current) {
          scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
      });
    }
  }, [globalChatMessages]);

  // Send message
  const handleSend = useCallback(async (text: string, files: File[]) => {
    try {
      let res: Response;

      if (files.length > 0) {
        const formData = new FormData();
        formData.append("text", text);
        for (const file of files) {
          formData.append("files", file);
        }
        res = await fetch("/api/chat/messages", {
          method: "POST",
          body: formData,
        });
      } else {
        res = await fetch("/api/chat/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
        });
      }

      if (res.ok) {
        // Message will arrive via WS broadcast — but also add optimistically
        const data = await res.json();
        if (data.message) {
          setMessages((prev) => {
            if (prev.some((m) => m.id === data.message.id)) return prev;
            return [...prev, data.message];
          });
          // Scroll to bottom
          requestAnimationFrame(() => {
            if (scrollRef.current) {
              scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
            }
          });
        }
      } else {
        const err = await res.json().catch(() => null);
        console.error("[chat] Send failed:", res.status, err);
      }
    } catch (e) {
      console.error("[chat] Send error:", e);
    }
  }, []);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="h-12 flex items-center justify-between px-4 border-b border-zinc-800/50 flex-shrink-0">
        <span className="text-sm font-medium text-zinc-300">Чат</span>
        {onToggleGallery && (
          <button
            onClick={onToggleGallery}
            className="p-1.5 text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer"
            title="Медиа"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
              <circle cx="9" cy="9" r="2" />
              <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
            </svg>
          </button>
        )}
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto overflow-x-hidden"
      >
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin h-6 w-6 border-2 border-violet-500 border-t-transparent rounded-full" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-zinc-600 text-sm">Нет сообщений</p>
          </div>
        ) : (
          <div className="py-2">
            {loadingOlder && (
              <div className="flex justify-center py-2">
                <div className="animate-spin h-4 w-4 border-2 border-zinc-600 border-t-zinc-400 rounded-full" />
              </div>
            )}
            {messages.map((msg, i) => {
              const prevDate = i > 0 ? messages[i - 1].createdAt : null;
              const showSep = shouldShowDateSeparator(prevDate, msg.createdAt);
              return (
                <div key={msg.id}>
                  {showSep && <DateSeparator date={msg.createdAt} />}
                  <ChatMessage
                    message={msg}
                    onImageClick={onImageClick}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Input */}
      <ChatInput
        disabled={isGuest}
        disabledTooltip="Зарегистрируйтесь для доступа к чату"
        onSend={handleSend}
      />
    </div>
  );
}

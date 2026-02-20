"use client";

import { usePresence } from "./PresenceProvider";
import UserAvatar from "./UserAvatar";

interface PresenceAvatarsProps {
  sessionId: string;
  maxVisible?: number;
}

export default function PresenceAvatars({ sessionId, maxVisible = 3 }: PresenceAvatarsProps) {
  const { sessionPeers, myPeerId } = usePresence();
  const peersInSession = sessionPeers[sessionId] || [];

  // Filter out self
  const otherPeers = peersInSession.filter((p) => p.peerId !== myPeerId);
  if (otherPeers.length === 0) return null;

  const visiblePeers = otherPeers.slice(0, maxVisible);
  const overflow = otherPeers.length - maxVisible;

  return (
    <div className="flex -space-x-1.5">
      {visiblePeers.map((peer) => (
        <UserAvatar
          key={peer.peerId}
          name={peer.name}
          colorIndex={peer.colorIndex}
          size="sm"
        />
      ))}
      {overflow > 0 && (
        <div className="w-5 h-5 rounded-full bg-zinc-800 border-2 border-zinc-950 flex items-center justify-center text-[9px] text-zinc-400">
          +{overflow}
        </div>
      )}
    </div>
  );
}

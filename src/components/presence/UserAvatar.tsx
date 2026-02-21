"use client";

import { PRESENCE_COLORS } from "@/lib/presence-colors";

interface UserAvatarProps {
  name: string;
  colorIndex: number;
  size?: "sm" | "md";
}

export default function UserAvatar({ name, colorIndex, size = "sm" }: UserAvatarProps) {
  const color = PRESENCE_COLORS[colorIndex % PRESENCE_COLORS.length];
  const px = size === "sm" ? 20 : 28;
  const fs = size === "sm" ? 9 : 12;

  return (
    <div
      className={`rounded-full flex items-center justify-center text-white font-medium border-2 border-background ${color.bg}`}
      style={{ width: px, height: px, fontSize: fs }}
      title={name}
    >
      {name.charAt(0)}
    </div>
  );
}

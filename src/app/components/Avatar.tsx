"use client";

import { useState } from "react";
import { getMonogram, resolveAvatar } from "../../lib/avatar";

type AvatarProps = {
  avatarUrl?: string | null;
  avatarName?: string | null;
  nickname?: string | null;
  email?: string | null;
  size?: number;
  className?: string;
};

/**
 * Renders a user's avatar: uploaded photo → chosen preset → initial monogram.
 * If an image fails to load, it falls back to the monogram (never an empty avatar).
 */
export default function Avatar({
  avatarUrl,
  avatarName,
  nickname,
  email,
  size = 32,
  className = "",
}: AvatarProps) {
  const resolved = resolveAvatar({ avatarUrl, avatarName, nickname, email });
  const [imageFailed, setImageFailed] = useState(false);
  const dims = { width: size, height: size };
  const label = nickname || email || "Avatar";

  if ((resolved.kind === "image" || resolved.kind === "preset") && !imageFailed) {
    return (
      <img
        src={resolved.url}
        alt={label}
        style={dims}
        className={`rounded-full object-cover bg-background dark:bg-background-dark-light ${className}`}
        onError={() => setImageFailed(true)}
      />
    );
  }

  const mono = resolved.kind === "monogram" ? resolved : getMonogram(nickname || email);
  return (
    <span
      aria-label={label}
      role="img"
      style={{ ...dims, backgroundColor: mono.bg, fontSize: Math.round(size * 0.42) }}
      className={`rounded-full inline-flex items-center justify-center text-white font-bold leading-none select-none ${className}`}
    >
      {mono.initial}
    </span>
  );
}

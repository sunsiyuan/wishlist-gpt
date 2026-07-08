/**
 * Avatar resolution: an uploaded photo, else an initial monogram derived from the
 * nickname/email (Google-style default). Presets were removed.
 */

// Deterministic, legible monogram backgrounds (Crisp neutrals + a few confident hues).
const MONOGRAM_COLORS = [
  "#0A0A0A",
  "#FE2C55",
  "#2563EB",
  "#059669",
  "#D97706",
  "#7C3AED",
  "#DB2777",
  "#0891B2",
];

export type ResolvedAvatar =
  | { kind: "image"; url: string }
  | { kind: "monogram"; initial: string; bg: string };

export function getMonogram(source: string | null | undefined): { initial: string; bg: string } {
  const text = (source ?? "").trim();
  const initial = text ? text.charAt(0).toUpperCase() : "?";
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash * 31 + text.charCodeAt(i)) | 0;
  }
  const bg = MONOGRAM_COLORS[Math.abs(hash) % MONOGRAM_COLORS.length];
  return { initial, bg };
}

/** Resolve which avatar to render. `email` is the monogram source when nickname is absent. */
export function resolveAvatar(params: {
  avatarUrl?: string | null;
  nickname?: string | null;
  email?: string | null;
}): ResolvedAvatar {
  const { avatarUrl, nickname, email } = params;
  if (avatarUrl && avatarUrl.trim()) {
    return { kind: "image", url: avatarUrl.trim() };
  }
  return { kind: "monogram", ...getMonogram(nickname || email) };
}

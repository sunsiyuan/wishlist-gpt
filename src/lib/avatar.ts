/**
 * Avatar resolution.
 *
 * Order of precedence (no empty avatars):
 *   1. Uploaded photo  (profiles.avatar_url — Supabase Storage)
 *   2. Preset          (profiles.avatar_name, only if explicitly chosen — legacy, now secondary)
 *   3. Monogram        (initial derived from nickname/email, like Google's default) — the default
 */

const PRESET_DEFAULT = "default";

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
  | { kind: "preset"; url: string; name: string }
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

function presetUrl(name: string): string {
  return `https://tapback.co/api/avatar/${name}.webp`;
}

/**
 * Resolve which avatar to render. `email` is the monogram fallback source when nickname is absent.
 */
export function resolveAvatar(params: {
  avatarUrl?: string | null;
  avatarName?: string | null;
  nickname?: string | null;
  email?: string | null;
}): ResolvedAvatar {
  const { avatarUrl, avatarName, nickname, email } = params;
  if (avatarUrl && avatarUrl.trim()) {
    return { kind: "image", url: avatarUrl.trim() };
  }
  if (avatarName && avatarName !== PRESET_DEFAULT && !avatarName.startsWith("upload:")) {
    return { kind: "preset", url: presetUrl(avatarName), name: avatarName };
  }
  return { kind: "monogram", ...getMonogram(nickname || email) };
}

/**
 * @deprecated Use resolveAvatar. Kept for legacy call sites that still pass a preset name.
 */
export function getAvatarUrl(avatarName: string): string {
  if (!avatarName || avatarName.startsWith("upload:")) {
    return presetUrl(PRESET_DEFAULT);
  }
  return presetUrl(avatarName);
}

export function isCustomAvatar(avatarName: string | null): boolean {
  return avatarName?.startsWith("upload:") ?? false;
}

export function sanitizeNextPath(next: string | null | undefined, fallback = "/"): string {
  if (!next) {
    return fallback;
  }
  if (!next.startsWith("/") || next.startsWith("//")) {
    return fallback;
  }
  return next;
}

/**
 * Avatar URL generation utilities
 * Supports Tapback avatars and future custom uploads
 */

/**
 * Get avatar URL from avatar_name
 * @param avatarName - Avatar identifier (e.g., "cat", "dog", or "upload:uuid")
 * @param userId - Optional user ID for custom avatar URLs (future use)
 * @returns Full URL to the avatar image
 */
export function getAvatarUrl(avatarName: string, userId?: string): string {
  if (!avatarName) {
    // Fallback to default avatar
    return "https://tapback.co/api/avatar/default.webp";
  }

  // Future: support custom uploads with "upload:" prefix
  if (avatarName.startsWith("upload:")) {
    // TODO: Implement Supabase Storage URL generation
    // const uuid = avatarName.replace("upload:", "");
    // return `${supabaseUrl}/storage/v1/object/public/avatars/${userId}/${uuid}`;
    // For now, fallback to default
    return "https://tapback.co/api/avatar/default.webp";
  }

  // Tapback avatar
  return `https://tapback.co/api/avatar/${avatarName}.webp`;
}

/**
 * Check if avatar_name represents a custom upload
 * @param avatarName - Avatar identifier
 * @returns true if it's a custom upload
 */
export function isCustomAvatar(avatarName: string | null): boolean {
  return avatarName?.startsWith("upload:") ?? false;
}

export const DEFAULT_PROFILE_CONTEXT = {
  preferred_language: "en-US",
};

export const POLICY_VERSION = "2026-01-11";

export type ProfileRecord = {
  user_id: string;
  preferred_language: string;
  accepted_at: string;
  policy_version: string;
  nickname: string;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
};

export function isProfileComplete(profile: ProfileRecord | null | undefined): boolean {
  if (!profile) {
    return false;
  }
  return Boolean(
    profile.preferred_language &&
      profile.accepted_at &&
      profile.policy_version &&
      profile.nickname,
  );
}

export function normalizeLanguage(value: string): string {
  return value.trim();
}

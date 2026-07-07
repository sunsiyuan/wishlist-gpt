export const DEFAULT_PROFILE_CONTEXT = {
  country_code: "UNKNOWN",
  preferred_language: "en-US",
  preferred_currency: "USD",
};

export const POLICY_VERSION = "2026-01-11";

export type ProfileRecord = {
  user_id: string;
  country_code: string;
  preferred_language: string;
  preferred_currency: string;
  accepted_at: string;
  policy_version: string;
  nickname: string;
  avatar_name: string;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
};

export function isProfileComplete(profile: ProfileRecord | null | undefined): boolean {
  if (!profile) {
    return false;
  }
  return Boolean(
    profile.country_code &&
      profile.preferred_language &&
      profile.preferred_currency &&
      profile.accepted_at &&
      profile.policy_version &&
      profile.nickname &&
      profile.avatar_name,
  );
}

export function normalizeCountryCode(value: string): string {
  return value.trim().toUpperCase();
}

export function normalizeCurrencyCode(value: string): string {
  return value.trim().toUpperCase();
}

export function normalizeLanguage(value: string): string {
  return value.trim();
}

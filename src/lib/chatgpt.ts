/**
 * Optional deep-link to the WishlistGPT app inside ChatGPT.
 *
 * Under the Apps SDK the app is added via the ChatGPT app directory / a connector, not a
 * legacy Custom GPT (`chatgpt.com/g/...`) URL — so there is no hardcoded fallback, and we
 * deliberately do NOT read the retired `CHATGPT_GPT_URL` var (it still lingers in some
 * environments and points at a Custom GPT that no longer exists). Set
 * `NEXT_PUBLIC_CHATGPT_APP_URL` once the app has a shareable directory link; until then the
 * UI falls back to self-serve connector instructions. Uses the NEXT_PUBLIC_ prefix so it
 * works on both server and client.
 */
export function getChatGptAppUrl(): string | null {
  const value = process.env.NEXT_PUBLIC_CHATGPT_APP_URL;
  return value && value.trim() ? value.trim() : null;
}

/**
 * Optional deep-link to the WishlistGPT app inside ChatGPT.
 *
 * Under the Apps SDK the app is added via the ChatGPT app directory / a connector, not a
 * legacy Custom GPT (`chatgpt.com/g/...`) URL — so there is no hardcoded fallback. Set
 * `NEXT_PUBLIC_CHATGPT_APP_URL` once the app has a shareable link; until then the UI hides
 * the "Open in ChatGPT" CTA. Uses the NEXT_PUBLIC_ prefix so it works on both server and client.
 */
export function getChatGptAppUrl(): string | null {
  const value = process.env.NEXT_PUBLIC_CHATGPT_APP_URL || process.env.CHATGPT_GPT_URL;
  return value && value.trim() ? value.trim() : null;
}

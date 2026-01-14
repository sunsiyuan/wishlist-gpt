/**
 * Get ChatGPT GPT URL from environment variable.
 * Falls back to production URL if not set.
 * 
 * Staging: https://chatgpt.com/g/g-69590ec742ac819197255326adcf1f7a-wishlistgpt-staging
 * Production: https://chatgpt.com/g/g-6963d49d46b4819197ad331b3167c2e8-wishlistgpt
 * 
 * For server-side usage (route handlers, server components).
 */
export function getChatGptUrl(): string {
  const envUrl = process.env.CHATGPT_GPT_URL;
  if (envUrl && envUrl.trim()) {
    return envUrl.trim();
  }
  // Fallback to production URL
  return "https://chatgpt.com/g/g-6963d49d46b4819197ad331b3167c2e8-wishlistgpt";
}

/**
 * Get ChatGPT GPT URL for client-side usage.
 * Uses NEXT_PUBLIC_ prefix so it's available in the browser.
 */
export function getChatGptUrlClient(): string {
  // Use NEXT_PUBLIC_ prefix for client-side access
  const envUrl = process.env.NEXT_PUBLIC_CHATGPT_GPT_URL || process.env.CHATGPT_GPT_URL;
  if (envUrl && envUrl.trim()) {
    return envUrl.trim();
  }
  
  // Fallback to production URL
  return "https://chatgpt.com/g/g-6963d49d46b4819197ad331b3167c2e8-wishlistgpt";
}

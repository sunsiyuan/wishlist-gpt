export type DisplayItem = {
  title: string | null;
  merchant_domain: string | null;
  price_amount_minor: number | null;
  currency: string | null;
  price_text: string | null;
  category?: string | null;
  personal_note: string | null;
  canonical_url?: string | null;
  url_original?: string | null;
};

const NOTE_PLACEHOLDER = "Add a note…";

/** Merchant logo, derived from the domain on read (no longer stored). */
export function getMerchantLogoUrl(item: DisplayItem): string | null {
  const domain = resolveDomain(item);
  if (!domain) {
    return null;
  }
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=128`;
}

export function getSourceUrl(item: DisplayItem): string | null {
  return item.canonical_url ?? item.url_original ?? null;
}

export function resolveDomain(item: DisplayItem): string | null {
  if (item.merchant_domain) {
    return item.merchant_domain;
  }
  const sourceUrl = getSourceUrl(item);
  if (!sourceUrl) {
    return null;
  }
  try {
    const url = new URL(sourceUrl);
    const host = url.hostname.replace(/^www\./i, "");
    return host || null;
  } catch (error) {
    return null;
  }
}

export function getCardTitle(item: DisplayItem): string {
  const title = item.title?.trim();
  if (title) {
    return title;
  }
  const domain = resolveDomain(item);
  if (domain) {
    return `From ${domain}`;
  }
  return "Untitled item";
}

export function shouldShowPriceRow(item: DisplayItem): boolean {
  const hasAmount = item.price_amount_minor !== null && !!item.currency;
  const hasText = Boolean(item.price_text?.trim());
  return hasAmount || hasText;
}

export function getPriceText(item: DisplayItem, locale?: string): string | null {
  const hasAmount = item.price_amount_minor !== null && !!item.currency;
  const priceText = item.price_text?.trim();
  if (hasAmount) {
    // Use locale from user's preferred_language, fallback to "en-US"
    // Ensure locale format is correct (e.g., "en-US" not just "en")
    const safeLocale = locale || "en-US";
    try {
      const formatter = new Intl.NumberFormat(safeLocale, {
        style: "currency",
        currency: item.currency ?? "",
        // Use narrow symbol format (e.g., "$" instead of "USD")
        currencyDisplay: "symbol",
      });
      const amount = (item.price_amount_minor ?? 0) / 100;
      return formatter.format(amount);
    } catch (error) {
      // Fallback to price_text if formatting fails
      return priceText || null;
    }
  }
  return priceText || null;
}

export function getNotePreview(item: DisplayItem): { text: string; isPlaceholder: boolean } {
  const note = item.personal_note?.trim();
  if (!note) {
    return { text: NOTE_PLACEHOLDER, isPlaceholder: true };
  }
  return { text: note, isPlaceholder: false };
}

export function shouldRenderMerchantLogo(item: DisplayItem): boolean {
  return Boolean(resolveDomain(item));
}

export function getLogoFallbackText(item: DisplayItem): string {
  const domain = resolveDomain(item);
  const initial = domain?.trim().charAt(0).toUpperCase();
  return initial || "🏬";
}

export function getCoverFallbackLabel(item: DisplayItem): string {
  const domain = resolveDomain(item);
  return domain ? `From ${domain}` : "Item";
}

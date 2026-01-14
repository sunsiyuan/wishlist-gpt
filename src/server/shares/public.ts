import { supabaseAdminFetch } from "../supabase/admin";

export type PublicShareItem = {
  id: string;
  created_at: string;
  display_cover_image_url: string | null;
  display_product_title: string | null;
  display_merchant_logo_url: string | null;
  display_merchant_domain: string | null;
  display_price_amount_minor: number | null;
  display_currency: string | null;
  display_price_text: string | null;
  display_price_updated_at: string | null;
  personal_note: string | null;
  canonical_url: string | null;
};

type PublicShareItemRecord = {
  id: string;
  created_at: string;
  display_cover_image_url: string | null;
  display_product_title: string | null;
  display_merchant_logo_url: string | null;
  display_merchant_domain: string | null;
  display_price_amount_minor: number | null;
  display_currency: string | null;
  display_price_text: string | null;
  display_price_updated_at: string | null;
  personal_note: string | null;
  canonical_url: string | null;
  url_original: string | null;
};

type ShareLookup = {
  id: string;
  user_id: string;
  revoked_at: string | null;
};

const SHARE_ID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidShareId(shareId: string): boolean {
  return SHARE_ID_REGEX.test(shareId);
}

export async function getPublicShareItems(shareId: string): Promise<PublicShareItem[] | null> {
  const shareSearch = new URLSearchParams({
    id: `eq.${shareId}`,
    limit: "1",
    select: "id,user_id,revoked_at",
  });
  const shareResponse = await supabaseAdminFetch(`/rest/v1/shares?${shareSearch.toString()}`);
  if (!shareResponse.ok) {
    throw new Error(`Failed to fetch share for public page: ${shareResponse.status}`);
  }
  const shareData = (await shareResponse.json()) as ShareLookup[];
  const share = shareData[0];
  if (!share || share.revoked_at) {
    return null;
  }

  const itemSearch = new URLSearchParams({
    user_id: `eq.${share.user_id}`,
    deleted_at: "is.null",
    order: "created_at.desc,id.desc",
    select: [
      "id",
      "created_at",
      "display_cover_image_url",
      "display_product_title",
      "display_merchant_logo_url",
      "display_merchant_domain",
      "display_price_amount_minor",
      "display_currency",
      "display_price_text",
      "display_price_updated_at",
      "personal_note",
      "canonical_url",
      "url_original",
    ].join(","),
  });
  const itemResponse = await supabaseAdminFetch(`/rest/v1/items?${itemSearch.toString()}`);
  if (!itemResponse.ok) {
    throw new Error(`Failed to fetch public share items: ${itemResponse.status}`);
  }
  const data = (await itemResponse.json()) as PublicShareItemRecord[];
  return data.map((item) => ({
    id: item.id,
    created_at: item.created_at,
    display_cover_image_url: item.display_cover_image_url,
    display_product_title: item.display_product_title,
    display_merchant_logo_url: item.display_merchant_logo_url,
    display_merchant_domain: item.display_merchant_domain,
    display_price_amount_minor: item.display_price_amount_minor,
    display_currency: item.display_currency,
    display_price_text: item.display_price_text,
    display_price_updated_at: item.display_price_updated_at,
    personal_note: item.personal_note,
    canonical_url: item.canonical_url ?? item.url_original ?? null,
  }));
}

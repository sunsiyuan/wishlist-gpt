import { supabaseAdminFetch } from "../supabase/admin";

export type PublicShareItem = {
  id: string;
  created_at: string;
  image_url: string | null;
  title: string | null;
  merchant_domain: string | null;
  price_amount_minor: number | null;
  currency: string | null;
  price_text: string | null;
  personal_note: string | null;
  canonical_url: string | null;
};

type PublicShareItemRecord = {
  id: string;
  created_at: string;
  image_url: string | null;
  title: string | null;
  merchant_domain: string | null;
  price_amount_minor: number | null;
  currency: string | null;
  price_text: string | null;
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
      "image_url",
      "title",
      "merchant_domain",
      "price_amount_minor",
      "currency",
      "price_text",
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
    image_url: item.image_url,
    title: item.title,
    merchant_domain: item.merchant_domain,
    price_amount_minor: item.price_amount_minor,
    currency: item.currency,
    price_text: item.price_text,
    personal_note: item.personal_note,
    canonical_url: item.canonical_url ?? item.url_original ?? null,
  }));
}

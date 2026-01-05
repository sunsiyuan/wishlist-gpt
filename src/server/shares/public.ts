import { supabaseAdminFetch } from "../supabase/admin";

export type PublicShareItem = {
  id: string;
  url_original: string;
  created_at: string;
  updated_at: string;
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
    order: "updated_at.desc,id.desc",
    select: "id,url_original,created_at,updated_at",
  });
  const itemResponse = await supabaseAdminFetch(`/rest/v1/items?${itemSearch.toString()}`);
  if (!itemResponse.ok) {
    throw new Error(`Failed to fetch public share items: ${itemResponse.status}`);
  }
  return (await itemResponse.json()) as PublicShareItem[];
}

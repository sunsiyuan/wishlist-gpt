import { supabaseAdminFetch } from "../supabase/admin";

const SUPABASE_ACCESS_TOKEN_COOKIE = "sb-access-token";

export function getSupabaseAccessTokenFromRequest(request: Request): string | null {
  const authHeader = request.headers.get("authorization");
  if (authHeader?.toLowerCase().startsWith("bearer ")) {
    return authHeader.slice(7).trim();
  }
  const cookieHeader = request.headers.get("cookie");
  if (!cookieHeader) {
    return null;
  }
  const cookies = cookieHeader.split(";").map((cookie) => cookie.trim());
  const tokenCookie = cookies.find((cookie) => cookie.startsWith(`${SUPABASE_ACCESS_TOKEN_COOKIE}=`));
  if (!tokenCookie) {
    return null;
  }
  return decodeURIComponent(tokenCookie.split("=")[1] ?? "");
}

export async function getSupabaseUserId(request: Request): Promise<string | null> {
  const accessToken = getSupabaseAccessTokenFromRequest(request);
  if (!accessToken) {
    return null;
  }
  const response = await supabaseAdminFetch("/auth/v1/user", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  if (!response.ok) {
    return null;
  }
  const data = (await response.json()) as { id?: string };
  return data?.id ?? null;
}

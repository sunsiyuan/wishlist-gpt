import { NextRequest, NextResponse } from "next/server";
import { createSupabaseRouteClient } from "../../lib/supabase/server";
import { clearAuthCookies } from "../../server/auth/logout";

export async function GET(request: NextRequest) {
  const loginUrl = new URL("/login", request.url);
  const response = NextResponse.redirect(loginUrl, 302);
  const supabase = createSupabaseRouteClient(request, response);
  await supabase.auth.signOut();
  return clearAuthCookies(request, response);
}

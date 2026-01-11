import { NextRequest, NextResponse } from "next/server";
import { createSupabaseRouteClient } from "../../../lib/supabase/server";
import { clearAuthCookies } from "../../../server/auth/logout";

export async function POST(request: NextRequest) {
  const response = NextResponse.json(
    { ok: true },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );

  const supabase = createSupabaseRouteClient(request, response);
  await supabase.auth.signOut();
  return clearAuthCookies(request, response);
}

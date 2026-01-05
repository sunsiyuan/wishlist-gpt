import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "../../../supabase/server";

function getRequestOrigin(request: NextRequest): string {
  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto") ?? "https";
  if (forwardedHost) {
    return `${forwardedProto}://${forwardedHost}`;
  }
  return request.nextUrl.origin;
}

function buildRedirect(origin: string, pathname: string, search?: string) {
  const url = new URL(pathname + (search ?? ""), origin);
  return NextResponse.redirect(url, 302);
}

export async function GET(request: NextRequest) {
  const origin = getRequestOrigin(request);
  const code = request.nextUrl.searchParams.get("code");
  if (!code) {
    return buildRedirect(origin, "/login", "?error=oauth_callback_failed");
  }

  const response = buildRedirect(origin, "/app");
  const supabase = createSupabaseServerClient(request, response);
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return buildRedirect(origin, "/login", "?error=oauth_callback_failed");
  }

  return response;
}

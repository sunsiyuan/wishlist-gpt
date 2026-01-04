import { NextRequest, NextResponse } from "next/server";
import { clearAuthCookies } from "../../server/auth/logout";

export async function GET(request: NextRequest) {
  const loginUrl = new URL("/login", request.url);
  const response = NextResponse.redirect(loginUrl, 302);
  return clearAuthCookies(request, response);
}

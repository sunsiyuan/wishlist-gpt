import { NextRequest, NextResponse } from "next/server";
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

  return clearAuthCookies(request, response);
}

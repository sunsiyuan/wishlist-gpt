"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { sanitizeNextPath } from "../../server/auth/next-path";
import { passwordGrantLogin } from "../../server/auth/password-grant";

const SUPABASE_ACCESS_TOKEN_COOKIE = "sb-access-token";
const DEFAULT_REDIRECT = "/";

function loginErrorRedirect(nextPath: string, reason: string) {
  const url = new URL("/login", "http://localhost");
  url.searchParams.set("next", nextPath);
  url.searchParams.set("error", reason);
  redirect(url.pathname + url.search);
}

export async function loginWithPassword(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = sanitizeNextPath(String(formData.get("next") ?? ""), DEFAULT_REDIRECT);

  if (!email || !password) {
    loginErrorRedirect(next, "missing");
  }

  const result = await passwordGrantLogin(email, password);
  if ("error" in result) {
    loginErrorRedirect(next, "invalid");
  }

  const maxAge = Number.isFinite(result.expiresIn) ? result.expiresIn : 3600;
  cookies().set(SUPABASE_ACCESS_TOKEN_COOKIE, result.accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge,
  });

  redirect(next);
}

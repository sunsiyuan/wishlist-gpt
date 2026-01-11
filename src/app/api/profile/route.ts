import { NextRequest, NextResponse } from "next/server";
import { createSupabaseRequestClient } from "../../../lib/supabase/server";
import {
  POLICY_VERSION,
  normalizeCountryCode,
  normalizeCurrencyCode,
  normalizeLanguage,
  type ProfileRecord,
} from "../../../lib/profile";
import { getProfileForUser } from "../../../server/profiles/store";

function isValidCountryCode(value: string): boolean {
  return /^[A-Z]{2}$/.test(value);
}

function isValidCurrencyCode(value: string): boolean {
  return /^[A-Z]{3}$/.test(value);
}

export async function GET(request: NextRequest) {
  const supabase = createSupabaseRequestClient(request);
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (!userId) {
    return NextResponse.json({ error: "missing session" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("profiles")
    .select(
      "user_id,country_code,preferred_language,preferred_currency,accepted_at,policy_version,created_at,updated_at",
    )
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: "failed to load profile" }, { status: 500 });
  }

  return NextResponse.json(
    { profile: (data ?? null) as ProfileRecord | null },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}

export async function POST(request: NextRequest) {
  const supabase = createSupabaseRequestClient(request);
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (!userId) {
    return NextResponse.json({ error: "missing session" }, { status: 401 });
  }

  let payload: {
    country_code?: string;
    preferred_language?: string;
    preferred_currency?: string;
  };

  try {
    payload = (await request.json()) as {
      country_code?: string;
      preferred_language?: string;
      preferred_currency?: string;
    };
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const countryCode = normalizeCountryCode(payload.country_code ?? "");
  const preferredLanguage = normalizeLanguage(payload.preferred_language ?? "");
  const preferredCurrency = normalizeCurrencyCode(payload.preferred_currency ?? "");

  if (!countryCode || !preferredLanguage || !preferredCurrency) {
    return NextResponse.json({ error: "missing fields" }, { status: 400 });
  }

  if (!isValidCountryCode(countryCode)) {
    return NextResponse.json({ error: "invalid country_code" }, { status: 400 });
  }

  if (!isValidCurrencyCode(preferredCurrency)) {
    return NextResponse.json({ error: "invalid preferred_currency" }, { status: 400 });
  }

  const existingProfile = await getProfileForUser(supabase, userId);
  const acceptedAt = existingProfile?.accepted_at ?? new Date().toISOString();
  const policyVersion = existingProfile?.policy_version ?? POLICY_VERSION;
  const now = new Date().toISOString();

  const { error } = await supabase.from("profiles").upsert(
    {
      user_id: userId,
      country_code: countryCode,
      preferred_language: preferredLanguage,
      preferred_currency: preferredCurrency,
      accepted_at: acceptedAt,
      policy_version: policyVersion,
      updated_at: now,
    },
    { onConflict: "user_id" },
  );

  if (error) {
    return NextResponse.json({ error: "failed to save profile" }, { status: 500 });
  }

  return NextResponse.json(
    { ok: true },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}

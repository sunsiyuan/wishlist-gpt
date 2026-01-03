type SupabasePasswordGrantResponse = {
  access_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
};

function getSupabaseUrl(): string {
  const url = process.env.SUPABASE_URL;
  if (!url) {
    throw new Error("SUPABASE_URL is required");
  }
  return url.replace(/\/$/, "");
}

function getSupabaseAnonKey(): string {
  const key = process.env.SUPABASE_ANON_KEY;
  if (!key) {
    throw new Error("SUPABASE_ANON_KEY is required");
  }
  return key;
}

export async function passwordGrantLogin(
  email: string,
  password: string,
): Promise<{ accessToken: string; expiresIn: number } | { error: string }> {
  const url = `${getSupabaseUrl()}/auth/v1/token?grant_type=password`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      apikey: getSupabaseAnonKey(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password }),
  });

  let data: SupabasePasswordGrantResponse | null = null;
  try {
    data = (await response.json()) as SupabasePasswordGrantResponse;
  } catch {
    data = null;
  }

  if (!response.ok || !data?.access_token) {
    return { error: data?.error ?? "invalid_login" };
  }

  return {
    accessToken: data.access_token,
    expiresIn: data.expires_in ?? 3600,
  };
}

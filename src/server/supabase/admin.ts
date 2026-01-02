function getSupabaseUrl(): string {
  const url = process.env.SUPABASE_URL;
  if (!url) {
    throw new Error("SUPABASE_URL is required");
  }
  return url.replace(/\/$/, "");
}

function getServiceRoleKey(): string {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is required");
  }
  return key;
}

export async function supabaseAdminFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const url = `${getSupabaseUrl()}${path}`;
  const headers = new Headers(options.headers);
  const serviceRoleKey = getServiceRoleKey();
  headers.set("apikey", serviceRoleKey);
  if (!headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${serviceRoleKey}`);
  }
  if (!headers.has("Content-Type") && options.body) {
    headers.set("Content-Type", "application/json");
  }
  return fetch(url, {
    ...options,
    headers,
  });
}

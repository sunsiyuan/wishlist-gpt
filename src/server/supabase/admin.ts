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

type SupabaseAdminFetchOptions = RequestInit & {
  timeoutMs?: number;
};

function createTimeoutError(timeoutMs: number): Error {
  const error = new Error(`Supabase request timed out after ${timeoutMs}ms`);
  error.name = "TimeoutError";
  return error;
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

export async function supabaseAdminFetch(
  path: string,
  options: SupabaseAdminFetchOptions = {},
): Promise<Response> {
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

  const { timeoutMs, ...fetchOptions } = options;
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  let signal = fetchOptions.signal;

  if (timeoutMs) {
    const controller = new AbortController();
    if (signal) {
      if (signal.aborted) {
        controller.abort();
      } else {
        signal.addEventListener("abort", () => controller.abort(), { once: true });
      }
    }
    signal = controller.signal;
    timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  }

  try {
    return await fetch(url, {
      ...fetchOptions,
      headers,
      signal,
    });
  } catch (error) {
    if (timeoutMs && isAbortError(error)) {
      throw createTimeoutError(timeoutMs);
    }
    throw error;
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

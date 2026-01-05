function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

export function getSupabaseUrl(): string {
  return getRequiredEnv("NEXT_PUBLIC_SUPABASE_URL").replace(/\/$/, "");
}

export function getSupabaseAnonKey(): string {
  return getRequiredEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
}

"use client";

import { useEffect, useMemo, useState, type ComponentProps } from "react";
import { Auth } from "@supabase/auth-ui-react";
import { ThemeSupa } from "@supabase/auth-ui-shared";
import { createSupabaseBrowserClient } from "../../supabase/client";

type AuthProviders = ComponentProps<typeof Auth>["providers"];

const PROVIDERS: AuthProviders =
  process.env.NEXT_PUBLIC_ENABLE_APPLE_OAUTH === "true" ? ["google", "apple"] : ["google"];

export default function AuthPanel() {
  const supabaseClient = useMemo(() => createSupabaseBrowserClient(), []);
  const [redirectTo, setRedirectTo] = useState<string | null>(null);

  useEffect(() => {
    setRedirectTo(`${window.location.origin}/auth/callback`);
  }, []);

  if (!redirectTo) {
    return <p>Loading sign-in options…</p>;
  }

  return (
    <Auth
      supabaseClient={supabaseClient}
      providers={PROVIDERS}
      redirectTo={redirectTo}
      appearance={{ theme: ThemeSupa }}
      magicLink
    />
  );
}

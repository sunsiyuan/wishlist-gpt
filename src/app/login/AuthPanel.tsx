"use client";

import { useEffect, useMemo, useState } from "react";
import { Auth } from "@supabase/auth-ui-react";
import { ThemeSupa } from "@supabase/auth-ui-shared";
import { createSupabaseBrowserClient } from "../../supabase/client";

const PROVIDERS = [
  "google",
  ...(process.env.NEXT_PUBLIC_ENABLE_APPLE_OAUTH === "true" ? ["apple"] : []),
];

export default function AuthPanel() {
  const supabaseClient = useMemo(() => createSupabaseBrowserClient(), []);
  const [redirectTo, setRedirectTo] = useState<string | undefined>(undefined);

  useEffect(() => {
    setRedirectTo(`${window.location.origin}/auth/callback`);
  }, []);

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

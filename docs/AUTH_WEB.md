# AUTH_WEB

## Web auth flow (Supabase SSR)

```text
/login
  └─ signInWithOAuth(provider=google, redirectTo=/auth/callback)
      └─ Google consent
          └─ /auth/callback?code=...
              └─ exchangeCodeForSession
                  └─ set sb-* cookies
                      └─ /app
```

## Callback behavior

* `/auth/callback` expects `?code=...`.
* Missing/invalid codes redirect to `/login?error=missing_code` or `/login?error=oauth_exchange_failed`.
* Successful exchange sets `sb-*` cookies and redirects to `/app` (or `next=` when present).

## Supabase console checklist

Ensure these settings are in place before testing OAuth:

1. **Site URL**
   * Local: `http://localhost:3000`
   * Preview: `https://<preview-domain>`
   * Production: `https://<prod-domain>`
2. **Redirect URLs**
   * `http://localhost:3000/auth/callback`
   * `https://<preview-domain>/auth/callback`
   * `https://<prod-domain>/auth/callback`

## Environment variables

Required in Next.js runtime (SSR + browser):

* `NEXT_PUBLIC_SUPABASE_URL`
* `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (fallback: `NEXT_PUBLIC_SUPABASE_ANON_KEY`)

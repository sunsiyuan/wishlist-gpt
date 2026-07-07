-- MCP / Apps SDK OAuth 2.1 support:
--  * PKCE (S256) + resource/scope binding on authorization codes
--  * Dynamic Client Registration (RFC 7591) so ChatGPT can self-register a client

alter table public.oauth_codes
  add column if not exists code_challenge text,
  add column if not exists code_challenge_method text,
  add column if not exists resource text,
  add column if not exists scope text;

create table if not exists public.oauth_clients (
  client_id text primary key,
  client_name text,
  redirect_uris jsonb not null default '[]'::jsonb,
  grant_types jsonb not null default '["authorization_code","refresh_token"]'::jsonb,
  token_endpoint_auth_method text not null default 'none',
  scope text,
  created_at timestamptz not null default now()
);

create index if not exists oauth_clients_created_at_idx on public.oauth_clients (created_at);

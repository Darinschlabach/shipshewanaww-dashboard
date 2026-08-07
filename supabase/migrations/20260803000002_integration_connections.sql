-- QuickBooks / third-party OAuth connection tokens (service-role only).
create table if not exists public.integration_connections (
  id uuid primary key default gen_random_uuid(),
  provider text not null unique,
  realm_id text,
  access_token text not null,
  refresh_token text not null,
  access_token_expires_at timestamptz not null,
  refresh_token_expires_at timestamptz,
  connected_by uuid references public.profiles (id) on delete set null,
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists integration_connections_provider_idx
  on public.integration_connections (provider);

alter table public.integration_connections enable row level security;

-- No policies for authenticated/anon: only service role can read/write.
comment on table public.integration_connections is
  'OAuth tokens for external integrations. Access only via service role.';

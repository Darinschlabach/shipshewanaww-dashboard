-- QuickBooks sync metadata + invoice line items (app is source of truth).

create type public.qb_sync_status as enum (
  'not_synced',
  'pending',
  'synced',
  'failed'
);

-- Contacts
alter table public.contacts
  add column if not exists qb_id text,
  add column if not exists qb_sync_token text,
  add column if not exists qb_sync_status public.qb_sync_status not null default 'not_synced',
  add column if not exists qb_last_synced_at timestamptz,
  add column if not exists qb_sync_error text;

create index if not exists contacts_qb_id_idx on public.contacts (qb_id);

-- Invoices
alter table public.invoices
  add column if not exists qb_id text,
  add column if not exists qb_sync_token text,
  add column if not exists qb_sync_status public.qb_sync_status not null default 'not_synced',
  add column if not exists qb_last_synced_at timestamptz,
  add column if not exists qb_sync_error text;

create index if not exists invoices_qb_id_idx on public.invoices (qb_id);

-- Invoice payments
alter table public.invoice_payments
  add column if not exists qb_id text,
  add column if not exists qb_sync_token text,
  add column if not exists qb_sync_status public.qb_sync_status not null default 'not_synced',
  add column if not exists qb_last_synced_at timestamptz,
  add column if not exists qb_sync_error text;

create index if not exists invoice_payments_qb_id_idx on public.invoice_payments (qb_id);

-- Line items (persisted for QuickBooks + PDF)
create table if not exists public.invoice_line_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices (id) on delete cascade,
  description text not null default '',
  qty numeric(12, 2) not null default 1,
  unit_price numeric(12, 2) not null default 0,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists invoice_line_items_invoice_id_idx
  on public.invoice_line_items (invoice_id);

alter table public.invoice_line_items enable row level security;

create policy "auth_all" on public.invoice_line_items
  for all to authenticated
  using (true)
  with check (true);

create trigger invoice_line_items_updated_at
  before update on public.invoice_line_items
  for each row execute function update_updated_at();

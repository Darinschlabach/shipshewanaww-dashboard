-- Persist payment reference (check #, last 4, etc.) for QuickBooks PaymentRefNum / notes.

alter table public.invoice_payments
  add column if not exists reference text;

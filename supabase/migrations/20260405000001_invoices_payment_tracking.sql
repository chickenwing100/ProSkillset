-- Add payment tracking fields for in-platform invoice payments

alter table if exists public.invoices
  add column if not exists payment_method text,
  add column if not exists payment_reference text,
  add column if not exists paid_amount numeric(12,2),
  add column if not exists paid_by_name text;

create index if not exists invoices_payment_reference_idx on public.invoices(payment_reference);

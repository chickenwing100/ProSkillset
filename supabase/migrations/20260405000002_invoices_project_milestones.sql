-- Add project linkage and milestone stage tracking to invoices

alter table if exists public.invoices
  add column if not exists related_job_id bigint,
  add column if not exists related_job_title text,
  add column if not exists related_job_po_number text,
  add column if not exists payment_stage text not null default 'full' check (payment_stage in ('full', 'upfront', 'progress', 'completion'));

create index if not exists invoices_related_job_id_idx on public.invoices(related_job_id);
create index if not exists invoices_payment_stage_idx on public.invoices(payment_stage);

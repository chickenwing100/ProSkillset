-- Invoicing support for ProSkillset

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  contractor_email text not null,
  contractor_name text,
  client_email text not null,
  client_name text,
  description text not null,
  amount numeric(12,2) not null check (amount > 0),
  due_date date not null,
  attachments jsonb not null default '[]'::jsonb,
  status text not null default 'draft' check (status in ('draft', 'sent', 'paid', 'overdue')),
  sent_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists invoices_contractor_email_idx on public.invoices(contractor_email);
create index if not exists invoices_client_email_idx on public.invoices(client_email);
create index if not exists invoices_status_idx on public.invoices(status);

create or replace function public.set_invoices_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_invoices_set_updated_at on public.invoices;
create trigger trg_invoices_set_updated_at
before update on public.invoices
for each row
execute function public.set_invoices_updated_at();

alter table public.invoices enable row level security;

drop policy if exists "Contractors can view their invoices" on public.invoices;
create policy "Contractors can view their invoices"
on public.invoices
for select
using (contractor_email = auth.email());

drop policy if exists "Clients can view their invoices" on public.invoices;
create policy "Clients can view their invoices"
on public.invoices
for select
using (client_email = auth.email());

drop policy if exists "Contractors can create invoices" on public.invoices;
create policy "Contractors can create invoices"
on public.invoices
for insert
with check (contractor_email = auth.email());

drop policy if exists "Contractors can update invoices" on public.invoices;
create policy "Contractors can update invoices"
on public.invoices
for update
using (contractor_email = auth.email())
with check (contractor_email = auth.email());

drop policy if exists "Clients can mark invoices paid" on public.invoices;
create policy "Clients can mark invoices paid"
on public.invoices
for update
using (client_email = auth.email())
with check (client_email = auth.email());

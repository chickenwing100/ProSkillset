-- Stripe billing, subscriptions, and contractor payout infrastructure

alter table if exists public.profiles
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_connect_account_id text,
  add column if not exists stripe_connect_onboarding_complete boolean not null default false,
  add column if not exists stripe_connect_details_submitted boolean not null default false;

create index if not exists profiles_stripe_customer_id_idx on public.profiles(stripe_customer_id);
create index if not exists profiles_stripe_connect_account_id_idx on public.profiles(stripe_connect_account_id);

create table if not exists public.contractor_subscriptions (
  id uuid primary key default gen_random_uuid(),
  contractor_email text not null unique,
  plan_id text not null,
  status text not null default 'inactive',
  stripe_customer_id text,
  stripe_subscription_id text unique,
  stripe_checkout_session_id text,
  stripe_price_id text,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint contractor_subscriptions_status_check check (status in ('incomplete', 'incomplete_expired', 'trialing', 'active', 'past_due', 'canceled', 'unpaid', 'paused', 'inactive'))
);

create index if not exists contractor_subscriptions_status_idx on public.contractor_subscriptions(status);
create index if not exists contractor_subscriptions_customer_idx on public.contractor_subscriptions(stripe_customer_id);

create or replace function public.set_contractor_subscriptions_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_contractor_subscriptions_set_updated_at on public.contractor_subscriptions;
create trigger trg_contractor_subscriptions_set_updated_at
before update on public.contractor_subscriptions
for each row
execute function public.set_contractor_subscriptions_updated_at();

alter table public.contractor_subscriptions enable row level security;

drop policy if exists "Contractors can view their subscription" on public.contractor_subscriptions;
create policy "Contractors can view their subscription"
on public.contractor_subscriptions
for select
using (contractor_email = auth.email());

drop policy if exists "Service role manages subscriptions" on public.contractor_subscriptions;
create policy "Service role manages subscriptions"
on public.contractor_subscriptions
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

create table if not exists public.invoice_payments (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  client_email text not null,
  contractor_email text not null,
  stripe_checkout_session_id text unique,
  stripe_payment_intent_id text,
  stripe_charge_id text,
  stripe_transfer_id text,
  stripe_connected_account_id text,
  amount numeric(12,2) not null check (amount > 0),
  currency text not null default 'usd',
  status text not null default 'pending',
  payment_method text,
  payment_reference text,
  paid_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint invoice_payments_status_check check (status in ('pending', 'open', 'paid', 'failed', 'expired', 'refunded'))
);

create index if not exists invoice_payments_invoice_id_idx on public.invoice_payments(invoice_id);
create index if not exists invoice_payments_client_email_idx on public.invoice_payments(client_email);
create index if not exists invoice_payments_contractor_email_idx on public.invoice_payments(contractor_email);
create index if not exists invoice_payments_status_idx on public.invoice_payments(status);

create or replace function public.set_invoice_payments_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_invoice_payments_set_updated_at on public.invoice_payments;
create trigger trg_invoice_payments_set_updated_at
before update on public.invoice_payments
for each row
execute function public.set_invoice_payments_updated_at();

alter table public.invoice_payments enable row level security;

drop policy if exists "Clients can view their invoice payments" on public.invoice_payments;
create policy "Clients can view their invoice payments"
on public.invoice_payments
for select
using (client_email = auth.email());

drop policy if exists "Contractors can view invoice payments to them" on public.invoice_payments;
create policy "Contractors can view invoice payments to them"
on public.invoice_payments
for select
using (contractor_email = auth.email());

drop policy if exists "Service role manages invoice payments" on public.invoice_payments;
create policy "Service role manages invoice payments"
on public.invoice_payments
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

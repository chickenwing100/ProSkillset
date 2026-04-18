create table if not exists public.jobs (
  id bigserial primary key,
  title text not null,
  po_number text not null default '',
  description text not null,
  budget numeric(12,2) not null default 0,
  budget_min numeric(12,2) not null default 0,
  budget_max numeric(12,2) not null default 0,
  trade text not null default '',
  category text not null default '',
  timeline text not null default '',
  urgency text not null default '',
  requirements text not null default '',
  location text not null default '',
  posted_by text not null,
  posted_by_name text not null default '',
  posted_date timestamptz not null default now(),
  status text not null default 'open' check (status in ('open', 'in_progress', 'pending_client_confirmation', 'completed', 'cancelled')),
  applications jsonb not null default '[]'::jsonb,
  photos jsonb not null default '[]'::jsonb,
  selected_contractor text not null default '',
  selected_contractor_name text not null default '',
  accepted_bid numeric(12,2) not null default 0,
  accepted_at timestamptz,
  progress_updates jsonb not null default '[]'::jsonb,
  completion_requested boolean not null default false,
  completion_requested_at timestamptz,
  completion_confirmed boolean not null default false,
  completion_confirmed_at timestamptz,
  progress numeric(5,2) not null default 0,
  progress_note text not null default '',
  progress_updated_by text not null default '',
  progress_updated_at timestamptz,
  status_updated_at timestamptz not null default now(),
  payment_schedule jsonb not null default '{"mode":"percent","upfrontPercent":0,"progressPercent":0,"completionPercent":100}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.jobs add column if not exists po_number text not null default '';
alter table public.jobs add column if not exists budget_min numeric(12,2) not null default 0;
alter table public.jobs add column if not exists budget_max numeric(12,2) not null default 0;
alter table public.jobs add column if not exists trade text not null default '';
alter table public.jobs add column if not exists timeline text not null default '';
alter table public.jobs add column if not exists urgency text not null default '';
alter table public.jobs add column if not exists requirements text not null default '';
alter table public.jobs add column if not exists posted_by_name text not null default '';
alter table public.jobs add column if not exists posted_date timestamptz not null default now();
alter table public.jobs add column if not exists applications jsonb not null default '[]'::jsonb;
alter table public.jobs add column if not exists photos jsonb not null default '[]'::jsonb;
alter table public.jobs add column if not exists selected_contractor text not null default '';
alter table public.jobs add column if not exists selected_contractor_name text not null default '';
alter table public.jobs add column if not exists accepted_bid numeric(12,2) not null default 0;
alter table public.jobs add column if not exists accepted_at timestamptz;
alter table public.jobs add column if not exists progress_updates jsonb not null default '[]'::jsonb;
alter table public.jobs add column if not exists completion_requested boolean not null default false;
alter table public.jobs add column if not exists completion_requested_at timestamptz;
alter table public.jobs add column if not exists completion_confirmed boolean not null default false;
alter table public.jobs add column if not exists completion_confirmed_at timestamptz;
alter table public.jobs add column if not exists progress numeric(5,2) not null default 0;
alter table public.jobs add column if not exists progress_note text not null default '';
alter table public.jobs add column if not exists progress_updated_by text not null default '';
alter table public.jobs add column if not exists progress_updated_at timestamptz;
alter table public.jobs add column if not exists status_updated_at timestamptz not null default now();
alter table public.jobs add column if not exists payment_schedule jsonb not null default '{"mode":"percent","upfrontPercent":0,"progressPercent":0,"completionPercent":100}'::jsonb;
alter table public.jobs add column if not exists created_at timestamptz not null default now();
alter table public.jobs add column if not exists updated_at timestamptz not null default now();

create index if not exists jobs_posted_by_idx on public.jobs(posted_by);
create index if not exists jobs_selected_contractor_idx on public.jobs(selected_contractor);
create index if not exists jobs_status_idx on public.jobs(status);
create index if not exists jobs_posted_date_idx on public.jobs(posted_date desc);

create or replace function public.set_jobs_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_jobs_set_updated_at on public.jobs;
create trigger trg_jobs_set_updated_at
before update on public.jobs
for each row
execute function public.set_jobs_updated_at();

alter table public.jobs enable row level security;

drop policy if exists "Authenticated users can view jobs" on public.jobs;
create policy "Authenticated users can view jobs"
on public.jobs
for select
using (auth.role() = 'authenticated');

drop policy if exists "Users can insert their own jobs" on public.jobs;
create policy "Users can insert their own jobs"
on public.jobs
for insert
with check (posted_by = auth.email());

drop policy if exists "Owners and selected contractors can update jobs" on public.jobs;
create policy "Owners and selected contractors can update jobs"
on public.jobs
for update
using (posted_by = auth.email() or selected_contractor = auth.email())
with check (posted_by = auth.email() or selected_contractor = auth.email());

drop policy if exists "Owners can delete their jobs" on public.jobs;
create policy "Owners can delete their jobs"
on public.jobs
for delete
using (posted_by = auth.email());

drop policy if exists "Service role has full access to jobs" on public.jobs;
create policy "Service role has full access to jobs"
on public.jobs
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');
alter table if exists public.profiles
  add column if not exists bio text,
  add column if not exists skills text[] default '{}',
  add column if not exists experience text,
  add column if not exists website text,
  add column if not exists hourly_rate numeric(10,2),
  add column if not exists trade_categories text[] default '{}',
  add column if not exists service_areas text[] default '{}',
  add column if not exists gallery_photos jsonb not null default '[]'::jsonb,
  add column if not exists licenses text,
  add column if not exists insurance_provider text,
  add column if not exists insurance_documents jsonb not null default '[]'::jsonb,
  add column if not exists insurance_review_status text not null default 'not_submitted',
  add column if not exists insurance_verified_by_admin boolean not null default false,
  add column if not exists insurance_reviewed_at timestamptz,
  add column if not exists insurance_reviewed_by text,
  add column if not exists contractor_name text,
  add column if not exists terms_accepted_at timestamptz,
  add column if not exists terms_version integer,
  add column if not exists contractor_agreement_accepted_at timestamptz,
  add column if not exists contractor_agreement_version integer;

alter table if exists public.profiles
  drop constraint if exists profiles_insurance_review_status_check;

alter table if exists public.profiles
  add constraint profiles_insurance_review_status_check
  check (insurance_review_status in ('not_submitted', 'pending_review', 'approved', 'rejected'));

create table if not exists public.messages (
  id bigint primary key,
  from_email text not null,
  from_name text,
  to_email text not null,
  text text not null,
  job_id bigint,
  job_title text,
  po_number text,
  read_by text[] not null default '{}',
  created_at timestamptz not null default now()
);

alter table public.messages add column if not exists from_email text not null default '';
alter table public.messages add column if not exists from_name text;
alter table public.messages add column if not exists to_email text not null default '';
alter table public.messages add column if not exists text text not null default '';
alter table public.messages add column if not exists job_id bigint;
alter table public.messages add column if not exists job_title text;
alter table public.messages add column if not exists po_number text;
alter table public.messages add column if not exists read_by text[] not null default '{}';
alter table public.messages add column if not exists created_at timestamptz not null default now();

create index if not exists messages_from_email_idx on public.messages(from_email);
create index if not exists messages_to_email_idx on public.messages(to_email);
create index if not exists messages_job_id_idx on public.messages(job_id);
create index if not exists messages_created_at_idx on public.messages(created_at desc);

alter table public.messages enable row level security;

drop policy if exists "Users can read visible messages" on public.messages;
create policy "Users can read visible messages"
  on public.messages for select
  using (
    from_email = auth.email()
    or to_email = auth.email()
    or exists (
      select 1 from public.profiles admin_profile
      where admin_profile.id = auth.uid() and admin_profile.role = 'admin'
    )
  );

drop policy if exists "Users can insert allowed messages" on public.messages;
create policy "Users can insert allowed messages"
  on public.messages for insert
  with check (
    from_email = auth.email()
    or (from_email = 'welcome@proskillset.app' and exists (
      select 1 from public.profiles admin_profile
      where admin_profile.id = auth.uid() and admin_profile.role = 'admin'
    ))
    or exists (
      select 1 from public.profiles admin_profile
      where admin_profile.id = auth.uid() and admin_profile.role = 'admin'
    )
  );

drop policy if exists "Users can update message read status" on public.messages;
create policy "Users can update message read status"
  on public.messages for update
  using (
    to_email = auth.email()
    or from_email = auth.email()
    or exists (
      select 1 from public.profiles admin_profile
      where admin_profile.id = auth.uid() and admin_profile.role = 'admin'
    )
  )
  with check (
    to_email = auth.email()
    or from_email = auth.email()
    or exists (
      select 1 from public.profiles admin_profile
      where admin_profile.id = auth.uid() and admin_profile.role = 'admin'
    )
  );

drop policy if exists "Service role manages messages" on public.messages;
create policy "Service role manages messages"
  on public.messages for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create table if not exists public.contractor_reviews (
  id text primary key,
  job_id bigint not null,
  contractor_email text not null,
  client_email text not null,
  rating integer not null,
  comment text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint contractor_reviews_rating_check check (rating between 1 and 5),
  constraint contractor_reviews_client_job_unique unique (job_id, client_email)
);

create index if not exists contractor_reviews_contractor_email_idx on public.contractor_reviews(contractor_email);
create index if not exists contractor_reviews_client_email_idx on public.contractor_reviews(client_email);

create or replace function public.set_contractor_reviews_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_contractor_reviews_set_updated_at on public.contractor_reviews;
create trigger trg_contractor_reviews_set_updated_at
before update on public.contractor_reviews
for each row
execute function public.set_contractor_reviews_updated_at();

alter table public.contractor_reviews enable row level security;

drop policy if exists "Authenticated users can view reviews" on public.contractor_reviews;
create policy "Authenticated users can view reviews"
  on public.contractor_reviews for select
  using (auth.role() = 'authenticated');

drop policy if exists "Clients can manage their reviews" on public.contractor_reviews;
create policy "Clients can manage their reviews"
  on public.contractor_reviews for all
  using (client_email = auth.email())
  with check (client_email = auth.email());

drop policy if exists "Service role manages reviews" on public.contractor_reviews;
create policy "Service role manages reviews"
  on public.contractor_reviews for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create table if not exists public.saved_contractors (
  id uuid primary key default gen_random_uuid(),
  user_email text not null,
  contractor_id text not null,
  contractor_email text not null,
  contractor_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (user_email, contractor_id)
);

alter table public.saved_contractors add column if not exists user_email text;
alter table public.saved_contractors add column if not exists contractor_id text;
alter table public.saved_contractors add column if not exists contractor_email text;
alter table public.saved_contractors add column if not exists contractor_data jsonb not null default '{}'::jsonb;
alter table public.saved_contractors add column if not exists created_at timestamptz not null default now();
alter table public.saved_contractors add column if not exists client_email text;
alter table public.saved_contractors add column if not exists contractor_name text;
alter table public.saved_contractors add column if not exists contractor_photo text;

update public.saved_contractors
set user_email = client_email
where user_email is null and client_email is not null;

update public.saved_contractors
set contractor_id = coalesce(nullif(contractor_id, ''), contractor_email)
where contractor_id is null or contractor_id = '';

update public.saved_contractors
set contractor_data = jsonb_strip_nulls(
  coalesce(contractor_data, '{}'::jsonb)
  || case when contractor_name is not null then jsonb_build_object('name', contractor_name) else '{}'::jsonb end
  || case when contractor_photo is not null then jsonb_build_object('photo', contractor_photo) else '{}'::jsonb end
  || case when contractor_email is not null then jsonb_build_object('email', contractor_email) else '{}'::jsonb end
)
where contractor_data = '{}'::jsonb;

alter table public.saved_contractors alter column user_email set not null;
alter table public.saved_contractors alter column contractor_id set not null;

create unique index if not exists saved_contractors_user_contractor_unique_idx
on public.saved_contractors(user_email, contractor_id);

create index if not exists saved_contractors_user_email_idx on public.saved_contractors(user_email);
create index if not exists saved_contractors_contractor_email_idx on public.saved_contractors(contractor_email);
create index if not exists saved_contractors_contractor_id_idx on public.saved_contractors(contractor_id);

alter table public.saved_contractors enable row level security;

drop policy if exists "Users can manage saved contractors" on public.saved_contractors;
create policy "Users can manage saved contractors"
  on public.saved_contractors for all
  using (user_email = auth.email())
  with check (user_email = auth.email());

drop policy if exists "Clients can manage saved contractors" on public.saved_contractors;

drop policy if exists "Service role manages saved contractors" on public.saved_contractors;
create policy "Service role manages saved contractors"
  on public.saved_contractors for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
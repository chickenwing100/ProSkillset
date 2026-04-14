-- Base profiles table. Must run before all other migrations that ALTER this table.

create table if not exists public.profiles (
  id                                  uuid primary key references auth.users(id) on delete cascade,
  email                               text unique not null,
  role                                text not null default 'client' check (role in ('client', 'contractor', 'admin')),
  full_name                           text,
  company                             text,
  location                            text,
  avatar_url                          text,
  portfolio                           jsonb,

  -- Account settings columns (20260404_account_settings_columns.sql)
  business_name                       text,
  contact_email                       text,
  phone_number                        text,
  service_area                        text,
  team_members                        text[],
  profile_photo_url                   text,

  -- Stripe billing columns (20260406_stripe_billing_infrastructure.sql)
  stripe_customer_id                  text,
  stripe_connect_account_id          text,
  stripe_connect_onboarding_complete  boolean not null default false,
  stripe_connect_details_submitted    boolean not null default false,

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Auto-create a profile row when a new user signs up via Supabase Auth.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, role, full_name)
  values (
    new.id,
    lower(trim(new.email)),
    coalesce(new.raw_user_meta_data->>'role', 'client'),
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Row Level Security
alter table public.profiles enable row level security;

drop policy if exists "Users can view their own profile" on public.profiles;
create policy "Users can view their own profile"
  on public.profiles for select
  using (auth.uid() = id);

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists "Users can insert their own profile" on public.profiles;
create policy "Users can insert their own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

drop policy if exists "Service role has full access to profiles" on public.profiles;
create policy "Service role has full access to profiles"
  on public.profiles for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

-- Allow contractor profiles to be read publicly (needed for job feed / contractor discovery).
drop policy if exists "Contractor profiles are publicly readable" on public.profiles;
create policy "Contractor profiles are publicly readable"
  on public.profiles for select
  using (role = 'contractor');

-- Indexes
create index if not exists profiles_email_idx on public.profiles (email);
create index if not exists profiles_role_idx  on public.profiles (role);

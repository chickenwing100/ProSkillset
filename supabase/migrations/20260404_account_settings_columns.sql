-- Contractor account settings columns for profiles table.
-- Run this in Supabase SQL Editor or through your migration workflow.

alter table if exists public.profiles
  add column if not exists business_name text,
  add column if not exists contact_email text,
  add column if not exists phone_number text,
  add column if not exists service_area text,
  add column if not exists team_members text[],
  add column if not exists profile_photo_url text;

-- Keep updated_at current when profile rows are changed.
create or replace function public.set_profiles_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_profiles_set_updated_at on public.profiles;
create trigger trg_profiles_set_updated_at
before update on public.profiles
for each row
execute function public.set_profiles_updated_at();

-- Helpful index for quick lookup by contact email.
create index if not exists profiles_contact_email_idx
  on public.profiles (contact_email);

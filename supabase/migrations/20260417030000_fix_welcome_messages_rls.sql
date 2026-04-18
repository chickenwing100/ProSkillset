-- Fix RLS to allow welcome messages to be inserted for any user
drop policy if exists "Users can insert allowed messages" on public.messages;
create policy "Users can insert allowed messages"
  on public.messages for insert
  with check (
    from_email = auth.email()
    or (from_email = 'welcome@proskillset.app' and to_email = auth.email())
    or exists (
      select 1 from public.profiles admin_profile
      where admin_profile.id = auth.uid() and admin_profile.role = 'admin'
    )
  );

drop policy if exists "Users can insert their own jobs" on public.jobs;
create policy "Users can insert their own jobs"
on public.jobs
for insert
with check (lower(posted_by) = lower(auth.email()));

drop policy if exists "Owners and selected contractors can update jobs" on public.jobs;
create policy "Owners and selected contractors can update jobs"
on public.jobs
for update
using (lower(posted_by) = lower(auth.email()) or lower(selected_contractor) = lower(auth.email()))
with check (lower(posted_by) = lower(auth.email()) or lower(selected_contractor) = lower(auth.email()));

drop policy if exists "Owners can delete their jobs" on public.jobs;
create policy "Owners can delete their jobs"
on public.jobs
for delete
using (lower(posted_by) = lower(auth.email()));

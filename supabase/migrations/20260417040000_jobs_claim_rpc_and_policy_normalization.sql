alter table if exists public.jobs
  add column if not exists category text not null default '',
  add column if not exists budget numeric(12,2) not null default 0;

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

create or replace function public.claim_job(target_job_id text, application_payload jsonb)
returns public.jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  current_job public.jobs%rowtype;
  existing_applications jsonb;
  next_application jsonb;
  current_email text := lower(coalesce(auth.email(), ''));
begin
  if auth.uid() is null or current_email = '' then
    raise exception 'Authentication required';
  end if;

  select *
  into current_job
  from public.jobs
  where id::text = trim(coalesce(target_job_id, ''))
  for update;

  if not found then
    raise exception 'Project not found';
  end if;

  if lower(coalesce(current_job.posted_by, '')) = current_email then
    raise exception 'You cannot claim your own project';
  end if;

  if coalesce(current_job.status, 'open') <> 'open' then
    raise exception 'This project is no longer open';
  end if;

  if coalesce(nullif(current_job.selected_contractor, ''), '') <> '' then
    raise exception 'A contractor has already been selected';
  end if;

  existing_applications := coalesce(current_job.applications, '[]'::jsonb);

  if exists (
    select 1
    from jsonb_array_elements(existing_applications) as application
    where lower(coalesce(application ->> 'applicant', '')) = current_email
  ) then
    raise exception 'You have already applied to this job';
  end if;

  if jsonb_array_length(existing_applications) >= 5 then
    raise exception 'This job has reached the maximum of 5 claims';
  end if;

  next_application := jsonb_build_object(
    'id', floor(extract(epoch from clock_timestamp()) * 1000)::bigint,
    'applicant', current_email,
    'applicantName', coalesce(application_payload ->> 'applicantName', ''),
    'message', coalesce(application_payload ->> 'message', ''),
    'bidAmount', coalesce((application_payload ->> 'bidAmount')::numeric, 0),
    'bidMin', coalesce((application_payload ->> 'bidMin')::numeric, 0),
    'bidMax', coalesce((application_payload ->> 'bidMax')::numeric, 0),
    'paymentSchedule', coalesce(application_payload -> 'paymentSchedule', '{"mode":"percent","upfrontPercent":0,"progressPercent":0,"completionPercent":100}'::jsonb),
    'status', 'pending',
    'appliedDate', now()
  );

  update public.jobs
  set applications = existing_applications || jsonb_build_array(next_application),
      status_updated_at = now()
  where id = current_job.id
  returning * into current_job;

  return current_job;
end;
$$;

revoke all on function public.claim_job(text, jsonb) from public;
grant execute on function public.claim_job(text, jsonb) to authenticated;
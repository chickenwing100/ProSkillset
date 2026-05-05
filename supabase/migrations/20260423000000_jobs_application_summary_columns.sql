alter table if exists public.jobs
  add column if not exists application_count integer not null default 0,
  add column if not exists applicant_emails jsonb not null default '[]'::jsonb;

update public.jobs
set
  application_count = coalesce(jsonb_array_length(coalesce(applications, '[]'::jsonb)), 0),
  applicant_emails = coalesce((
    select jsonb_agg(lower(applicant_email))
    from (
      select distinct nullif(lower(application ->> 'applicant'), '') as applicant_email
      from jsonb_array_elements(coalesce(public.jobs.applications, '[]'::jsonb)) as application
    ) normalized
    where applicant_email is not null
  ), '[]'::jsonb);

create or replace function public.sync_job_application_summary()
returns trigger
language plpgsql
as $$
begin
  new.application_count := coalesce(jsonb_array_length(coalesce(new.applications, '[]'::jsonb)), 0);
  new.applicant_emails := coalesce((
    select jsonb_agg(applicant_email)
    from (
      select distinct nullif(lower(application ->> 'applicant'), '') as applicant_email
      from jsonb_array_elements(coalesce(new.applications, '[]'::jsonb)) as application
    ) normalized
    where applicant_email is not null
  ), '[]'::jsonb);
  return new;
end;
$$;

drop trigger if exists trg_jobs_sync_application_summary on public.jobs;
create trigger trg_jobs_sync_application_summary
before insert or update of applications on public.jobs
for each row
execute function public.sync_job_application_summary();

update public.jobs
set applications = coalesce(applications, '[]'::jsonb)
where true;
-- Replace the legacy questionnaire schema. This intentionally preserves auth and Supabase system schemas.
drop table if exists public.result_records cascade;
drop table if exists public.results cascade;
drop table if exists public.questions cascade;
drop table if exists public.dimensions cascade;
drop table if exists public.settings cascade;

create type public.resume_parse_status as enum ('pending', 'processing', 'ready', 'failed');
create type public.analysis_status as enum ('pending', 'processing', 'completed', 'failed');
create type public.usage_event_type as enum ('analysis_requested', 'analysis_completed', 'analysis_failed');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text check (char_length(display_name) between 1 and 50),
  target_role text check (char_length(target_role) <= 100),
  onboarding_completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.resumes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  file_path text not null unique,
  file_name text not null check (char_length(file_name) between 1 and 255),
  mime_type text not null check (mime_type = 'application/pdf'),
  file_size bigint not null check (file_size > 0 and file_size <= 20971520),
  parsed_text text,
  parse_status public.resume_parse_status not null default 'pending',
  parse_error text,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.job_descriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  job_title text not null check (char_length(job_title) between 1 and 120),
  company_name text check (char_length(company_name) <= 120),
  location text check (char_length(location) <= 120),
  source_text text not null check (char_length(source_text) between 20 and 20000),
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.analysis_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  resume_id uuid not null references public.resumes(id) on delete cascade,
  job_description_id uuid not null references public.job_descriptions(id) on delete cascade,
  status public.analysis_status not null default 'pending',
  model text not null check (char_length(model) between 1 and 100),
  input_snapshot jsonb not null,
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint completed_runs_have_completion_time check (
    status not in ('completed', 'failed') or completed_at is not null
  ),
  constraint failed_runs_have_error_message check (
    status <> 'failed' or error_message is not null
  )
);

create table public.analysis_results (
  id uuid primary key default gen_random_uuid(),
  analysis_run_id uuid not null unique references public.analysis_runs(id) on delete cascade,
  score smallint not null check (score between 0 and 100),
  result_json jsonb not null,
  prompt_version text not null check (char_length(prompt_version) between 1 and 80),
  created_at timestamptz not null default now()
);

create table public.usage_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  analysis_run_id uuid references public.analysis_runs(id) on delete set null,
  event_type public.usage_event_type not null,
  created_at timestamptz not null default now()
);

create unique index resumes_one_default_per_user
  on public.resumes (user_id)
  where is_default;
create index resumes_user_created_at_idx on public.resumes (user_id, created_at desc);
create index job_descriptions_user_created_at_idx on public.job_descriptions (user_id, created_at desc);
create index analysis_runs_user_created_at_idx on public.analysis_runs (user_id, created_at desc);
create index analysis_runs_resume_id_idx on public.analysis_runs (resume_id);
create index analysis_runs_job_description_id_idx on public.analysis_runs (job_description_id);
create index analysis_results_run_id_idx on public.analysis_results (analysis_run_id);
create index usage_events_user_created_at_idx on public.usage_events (user_id, created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.create_profile_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end;
$$;

revoke all on function public.create_profile_for_new_user() from public;

create trigger set_profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger set_resumes_updated_at before update on public.resumes
  for each row execute function public.set_updated_at();
create trigger set_job_descriptions_updated_at before update on public.job_descriptions
  for each row execute function public.set_updated_at();
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.create_profile_for_new_user();

alter table public.profiles enable row level security;
alter table public.resumes enable row level security;
alter table public.job_descriptions enable row level security;
alter table public.analysis_runs enable row level security;
alter table public.analysis_results enable row level security;
alter table public.usage_events enable row level security;

grant usage on schema public to authenticated;
grant select, update on public.profiles to authenticated;
grant select, insert, update, delete on public.resumes to authenticated;
grant select, insert, update, delete on public.job_descriptions to authenticated;
grant select on public.analysis_runs to authenticated;
grant select on public.analysis_results to authenticated;
grant select on public.usage_events to authenticated;

create policy "users can select own profile" on public.profiles
  for select to authenticated
  using ((select auth.uid()) = id);
create policy "users can update own profile" on public.profiles
  for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

create policy "users can select own resumes" on public.resumes
  for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "users can insert own resumes" on public.resumes
  for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "users can update own resumes" on public.resumes
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "users can delete own resumes" on public.resumes
  for delete to authenticated
  using ((select auth.uid()) = user_id);

create policy "users can select own job descriptions" on public.job_descriptions
  for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "users can insert own job descriptions" on public.job_descriptions
  for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "users can update own job descriptions" on public.job_descriptions
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "users can delete own job descriptions" on public.job_descriptions
  for delete to authenticated
  using ((select auth.uid()) = user_id);

create policy "users can select own analysis runs" on public.analysis_runs
  for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "users can select own analysis results" on public.analysis_results
  for select to authenticated
  using (exists (
    select 1 from public.analysis_runs
    where analysis_runs.id = analysis_results.analysis_run_id
      and analysis_runs.user_id = (select auth.uid())
  ));
create policy "users can select own usage events" on public.usage_events
  for select to authenticated
  using ((select auth.uid()) = user_id);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('resume-files', 'resume-files', false, 20971520, array['application/pdf'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "users can select their resume files" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'resume-files'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );
create policy "users can upload their resume files" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'resume-files'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );
create policy "users can update their resume files" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'resume-files'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  )
  with check (
    bucket_id = 'resume-files'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );
create policy "users can delete their resume files" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'resume-files'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

-- Online resume page generator (v2). Additive migration only: creates the
-- resume_pages table, enum, indexes, trigger and RLS policies. It does not
-- modify existing tables, policies or migrations.

create type public.resume_page_status as enum ('draft', 'published');

create table public.resume_pages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_resume_id uuid references public.resumes(id) on delete set null,
  source_analysis_run_id uuid references public.analysis_runs(id) on delete set null,
  slug text unique check (slug ~ '^[a-z0-9]{10}$'),
  title text not null check (char_length(title) between 1 and 120),
  theme_id text not null default 'clean-pro' check (char_length(theme_id) between 1 and 60),
  content jsonb not null default '{}'::jsonb,
  pdf_download_enabled boolean not null default true,
  status public.resume_page_status not null default 'draft',
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index resume_pages_user_created_at_idx on public.resume_pages (user_id, created_at desc);
create index resume_pages_slug_idx on public.resume_pages (slug) where slug is not null;

create trigger set_resume_pages_updated_at before update on public.resume_pages
  for each row execute function public.set_updated_at();

alter table public.resume_pages enable row level security;

grant usage on schema public to anon;
grant select on public.resume_pages to anon;
grant select, insert, update, delete on public.resume_pages to authenticated;

create policy "users can select own resume pages" on public.resume_pages
  for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "users can insert own resume pages" on public.resume_pages
  for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "users can update own resume pages" on public.resume_pages
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "users can delete own resume pages" on public.resume_pages
  for delete to authenticated
  using ((select auth.uid()) = user_id);

create policy "published resume pages are public" on public.resume_pages
  for select to anon
  using (status = 'published');

-- Track AI page generation progress so the wizard can poll instead of
-- blocking on a long LLM call. Additive migration: adds columns only.

alter table public.resume_pages
  add column if not exists generation_status text not null default 'idle'
    check (generation_status in ('idle', 'pending', 'processing', 'completed', 'failed'));

alter table public.resume_pages
  add column if not exists generation_error text;

-- 点数计费 + Waffo 支付 + LLM 用量统计（追加式迁移，只新增对象，不改动已有表）。

create type public.credit_event_type as enum ('signup_bonus', 'purchase', 'consume', 'admin_grant');
create type public.payment_order_status as enum ('pending', 'paid', 'failed', 'expired', 'refunded');

create table if not exists public.credit_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_type public.credit_event_type not null,
  event_ref uuid,
  amount integer not null check (amount <> 0),
  note text,
  created_at timestamptz not null default now()
);

create unique index if not exists credit_ledger_user_event_ref_idx
  on public.credit_ledger (user_id, event_type, event_ref);
create index if not exists credit_ledger_user_created_idx
  on public.credit_ledger (user_id, created_at desc);

create table if not exists public.payment_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  pack_id text not null check (char_length(pack_id) between 1 and 60),
  credits integer not null check (credits > 0),
  amount_cents integer not null check (amount_cents > 0),
  currency text not null default 'USD' check (char_length(currency) = 3),
  status public.payment_order_status not null default 'pending',
  waffo_order_id text,
  waffo_session_id text,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists payment_orders_waffo_order_idx
  on public.payment_orders (waffo_order_id) where waffo_order_id is not null;
create index if not exists payment_orders_user_created_idx
  on public.payment_orders (user_id, created_at desc);

create table if not exists public.llm_usage_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (char_length(provider) between 1 and 40),
  model text not null check (char_length(model) between 1 and 100),
  purpose text not null check (purpose in ('analysis', 'resume_page')),
  event_ref uuid,
  prompt_tokens integer,
  completion_tokens integer,
  total_tokens integer,
  created_at timestamptz not null default now()
);

create index if not exists llm_usage_user_created_idx
  on public.llm_usage_events (user_id, created_at desc);

create trigger set_payment_orders_updated_at before update on public.payment_orders
  for each row execute function public.set_updated_at();

alter table public.credit_ledger enable row level security;
alter table public.payment_orders enable row level security;
alter table public.llm_usage_events enable row level security;

grant usage on schema public to authenticated;
grant select on public.credit_ledger to authenticated;
grant select on public.payment_orders to authenticated;
grant select on public.llm_usage_events to authenticated;

create policy "users can select own credits" on public.credit_ledger
  for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "users can select own payment orders" on public.payment_orders
  for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "users can select own llm usage" on public.llm_usage_events
  for select to authenticated
  using ((select auth.uid()) = user_id);

create or replace function public.grant_free_credits_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.credit_ledger (user_id, event_type, amount, note)
  values (new.id, 'signup_bonus', 2, '新账号免费额度');
  return new;
end;
$$;

revoke all on function public.grant_free_credits_for_new_user() from public;
revoke all on function public.grant_free_credits_for_new_user() from anon;
revoke all on function public.grant_free_credits_for_new_user() from authenticated;

create trigger on_auth_user_created_credits after insert on auth.users
  for each row execute function public.grant_free_credits_for_new_user();

-- 存量用户回填免费额度
insert into public.credit_ledger (user_id, event_type, amount, note)
select id, 'signup_bonus', 2, '新账号免费额度'
from auth.users
where not exists (
  select 1 from public.credit_ledger c
  where c.user_id = auth.users.id and c.event_type = 'signup_bonus'
);

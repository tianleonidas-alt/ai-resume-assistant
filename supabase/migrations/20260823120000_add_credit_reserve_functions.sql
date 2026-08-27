-- 原子预扣/释放点数，防止并发分析透支；提供过期预扣清理。

create or replace function public.reserve_credit(p_user uuid, p_ref uuid, p_note text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare v_balance bigint;
begin
  perform pg_advisory_xact_lock(hashtext('credit:' || p_user::text));
  select coalesce(sum(amount), 0) into v_balance from public.credit_ledger where user_id = p_user;
  if v_balance < 1 then
    return false;
  end if;
  insert into public.credit_ledger (user_id, event_type, event_ref, amount, note)
  values (p_user, 'consume', p_ref, -1, p_note);
  return true;
end;
$$;

create or replace function public.release_credit(p_user uuid, p_ref uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.credit_ledger
  where user_id = p_user and event_type = 'consume' and event_ref = p_ref;
end;
$$;

create or replace function public.release_stale_credits(p_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.credit_ledger c
  where c.user_id = p_user
    and c.event_type = 'consume'
    and c.created_at < now() - interval '2 hours'
    and not exists (
      select 1 from public.analysis_runs r
      where r.id = c.event_ref and r.status = 'completed'
    )
    and not exists (
      select 1 from public.resume_pages p
      where p.id = c.event_ref and p.generation_status = 'completed'
    );
end;
$$;

revoke all on function public.reserve_credit(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.release_credit(uuid, uuid) from public, anon, authenticated;
revoke all on function public.release_stale_credits(uuid) from public, anon, authenticated;

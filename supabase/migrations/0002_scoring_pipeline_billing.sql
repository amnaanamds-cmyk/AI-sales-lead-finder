-- Weeks 2-5: AI scoring, pipeline, monthly credits, packs and payments.

-- ---------------------------------------------------------------------------
-- Scoring is per service: a web dev and an SEO person score the same lead differently.
-- ---------------------------------------------------------------------------
alter table public.lead_scores add column service_type text not null default '';

-- ---------------------------------------------------------------------------
-- Credits: a monthly allowance that resets, plus pack credits that never expire.
-- ---------------------------------------------------------------------------
alter table public.workspaces
  add column bonus_credits integer not null default 0 check (bonus_credits >= 0),
  add column plan_expires_at timestamptz,
  add column credits_reset_at timestamptz not null default (now() + interval '1 month');

-- Keep in sync with src/lib/plans.ts.
create function public.plan_allowance(p public.plan)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case p
    when 'free' then 20
    when 'freelancer' then 300
    when 'agency' then 1500
  end;
$$;

-- Lazily apply plan expiry and the monthly reset. Safe to call on every read.
create function public.refresh_credits(ws uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  w public.workspaces;
begin
  if not public.is_workspace_member(ws) and auth.role() <> 'service_role' then
    raise exception 'not a member of workspace %', ws;
  end if;

  select * into w from public.workspaces where id = ws for update;

  if w.plan <> 'free' and w.plan_expires_at is not null and w.plan_expires_at <= now() then
    update public.workspaces
    set plan = 'free',
        plan_expires_at = null,
        credits_left = least(credits_left, public.plan_allowance('free'))
    where id = ws;
    w.plan := 'free';
  end if;

  if w.credits_reset_at <= now() then
    update public.workspaces
    set credits_left = public.plan_allowance(w.plan),
        -- Step forward whole months so the reset day stays stable.
        credits_reset_at = w.credits_reset_at
          + interval '1 month' * (1 + floor(extract(epoch from now() - w.credits_reset_at) / extract(epoch from interval '1 month')))
    where id = ws;
  end if;
end;
$$;

-- Take up to `requested` credits: monthly allowance first, then pack credits.
create or replace function public.consume_credits(ws uuid, requested integer)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  w public.workspaces;
  from_monthly integer;
  from_bonus integer;
begin
  perform public.refresh_credits(ws);

  select * into w from public.workspaces where id = ws for update;
  from_monthly := least(w.credits_left, greatest(requested, 0));
  from_bonus := least(w.bonus_credits, greatest(requested, 0) - from_monthly);

  update public.workspaces
  set credits_left = credits_left - from_monthly,
      bonus_credits = bonus_credits - from_bonus
  where id = ws;

  return from_monthly + from_bonus;
end;
$$;

-- ---------------------------------------------------------------------------
-- Payments
-- ---------------------------------------------------------------------------
alter table public.payments
  add column product text not null default '',
  add column txn_ref text unique,
  add column provider_response jsonb,
  add column paid_at timestamptz;

-- Mark a pending payment paid and grant what it bought. Idempotent: a second call
-- for the same txn_ref does nothing. Called by the payment return handler with the
-- service role only.
create function public.fulfil_payment(p_txn_ref text, p_amount integer, p_response jsonb)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  p public.payments;
  w public.workspaces;
begin
  update public.payments
  set status = 'paid', paid_at = now(), provider_response = p_response
  where txn_ref = p_txn_ref and status = 'pending' and amount = p_amount
  returning * into p;

  if not found then
    return false;
  end if;

  select * into w from public.workspaces where id = p.workspace_id for update;

  if p.product in ('freelancer', 'agency') then
    update public.workspaces
    set plan = p.product::public.plan,
        -- Renewing the same plan early stacks the month; switching starts now.
        plan_expires_at = case
          when w.plan = p.product::public.plan and w.plan_expires_at > now()
            then w.plan_expires_at + interval '30 days'
          else now() + interval '30 days'
        end,
        credits_left = public.plan_allowance(p.product::public.plan),
        credits_reset_at = now() + interval '1 month'
    where id = p.workspace_id;
  elsif p.product like 'pack_%' then
    update public.workspaces
    set bonus_credits = bonus_credits + split_part(p.product, '_', 2)::integer
    where id = p.workspace_id;
  else
    raise exception 'unknown product %', p.product;
  end if;

  return true;
end;
$$;

revoke execute on function public.fulfil_payment(text, integer, jsonb) from public, anon, authenticated;
grant execute on function public.fulfil_payment(text, integer, jsonb) to service_role;

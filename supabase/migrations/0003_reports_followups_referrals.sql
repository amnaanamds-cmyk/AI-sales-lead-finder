-- Shareable audit reports, pipeline history + deal values, contact details, referrals.

-- ---------------------------------------------------------------------------
-- Profile: how prospects reach the freelancer, and their referral code
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column whatsapp text,
  add column portfolio_url text,
  add column referral_code text unique default lower(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
  add column referred_by uuid references public.profiles (id) on delete set null;

update public.profiles set referral_code = lower(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))
where referral_code is null;

-- ---------------------------------------------------------------------------
-- Shareable reports: a public, unguessable link per lead.
-- `title` is typed by the user (prefilled with the business name); findings are our own
-- website-check results. Nothing here is a copy of Google Places content.
-- ---------------------------------------------------------------------------
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  token text not null unique default replace(replace(encode(gen_random_bytes(12), 'base64'), '/', '_'), '+', '-'),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  lead_id uuid not null references public.leads (id) on delete cascade,
  created_by uuid not null references public.profiles (id) on delete cascade,
  title text not null check (length(title) between 1 and 120),
  intro text not null default '' check (length(intro) <= 1500),
  findings jsonb not null default '[]'::jsonb,
  quote jsonb not null default '[]'::jsonb,
  view_count integer not null default 0,
  last_viewed_at timestamptz,
  created_at timestamptz not null default now()
);
create index reports_lead_id_idx on public.reports (lead_id);
create index reports_workspace_viewed_idx on public.reports (workspace_id, last_viewed_at desc);

alter table public.reports enable row level security;
create policy "member: all reports" on public.reports
  for all using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id) and created_by = auth.uid());

-- Public view of a report by token. Records the view unless the owner is looking or the
-- caller says it's a link-preview bot (WhatsApp fetches every link to build a preview).
-- Returns only what the page shows, including the sender's public contact details.
create function public.view_report(p_token text, p_count boolean default true)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.reports;
  p public.profiles;
begin
  select * into r from public.reports where token = p_token;
  if not found then
    return null;
  end if;

  if p_count and auth.uid() is distinct from r.created_by then
    update public.reports
    set view_count = view_count + 1, last_viewed_at = now()
    where id = r.id;
  end if;

  select * into p from public.profiles where id = r.created_by;
  return jsonb_build_object(
    'title', r.title,
    'intro', r.intro,
    'findings', r.findings,
    'quote', r.quote,
    'created_at', r.created_at,
    'sender', jsonb_build_object(
      'name', p.name,
      'whatsapp', p.whatsapp,
      'portfolio_url', p.portfolio_url,
      'service_type', p.service_type,
      'referral_code', p.referral_code
    )
  );
end;
$$;
grant execute on function public.view_report(text, boolean) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Pipeline: deal value, and a history of stage changes for reply-rate / win stats
-- ---------------------------------------------------------------------------
alter table public.pipeline add column deal_value integer check (deal_value is null or deal_value >= 0);

create table public.pipeline_events (
  id bigint generated always as identity primary key,
  lead_id uuid not null references public.leads (id) on delete cascade,
  stage public.pipeline_stage not null,
  at timestamptz not null default now()
);
create index pipeline_events_lead_idx on public.pipeline_events (lead_id, at);

alter table public.pipeline_events enable row level security;
create policy "member: read pipeline_events" on public.pipeline_events
  for select using (public.is_lead_member(lead_id));

create function public.log_pipeline_stage()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' or new.stage is distinct from old.stage then
    insert into public.pipeline_events (lead_id, stage) values (new.lead_id, new.stage);
  end if;
  return new;
end;
$$;

create trigger pipeline_stage_log
  after insert or update of stage on public.pipeline
  for each row execute function public.log_pipeline_stage();

-- Funnel numbers for the dashboard. A lead counts for every stage it has ever reached.
create function public.workspace_stats(ws uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with reached as (
    select e.lead_id,
      bool_or(e.stage in ('contacted', 'replied', 'meeting', 'won')) as contacted,
      bool_or(e.stage in ('replied', 'meeting', 'won')) as replied,
      bool_or(e.stage in ('meeting', 'won')) as meeting,
      bool_or(e.stage = 'won') as won,
      max(e.at) filter (where e.stage = 'won') as won_at
    from public.pipeline_events e
    join public.leads l on l.id = e.lead_id
    where l.workspace_id = ws
    group by e.lead_id
  )
  select case when not public.is_workspace_member(ws) then null else jsonb_build_object(
    'contacted', (select count(*) from reached where contacted),
    'replied', (select count(*) from reached where replied),
    'meetings', (select count(*) from reached where meeting),
    'won', (select count(*) from reached r join public.pipeline p on p.lead_id = r.lead_id where p.stage = 'won'),
    'won_value', (select coalesce(sum(p.deal_value), 0) from public.pipeline p join public.leads l on l.id = p.lead_id
                  where l.workspace_id = ws and p.stage = 'won'),
    'won_this_month', (select count(*) from reached r join public.pipeline p on p.lead_id = r.lead_id
                       where p.stage = 'won' and r.won_at >= date_trunc('month', now())),
    'open_value', (select coalesce(sum(p.deal_value), 0) from public.pipeline p join public.leads l on l.id = p.lead_id
                   where l.workspace_id = ws and p.stage in ('contacted', 'replied', 'meeting')),
    'report_views', (select coalesce(sum(view_count), 0) from public.reports where workspace_id = ws),
    'leads', (select count(*) from public.leads where workspace_id = ws)
  ) end;
$$;

-- ---------------------------------------------------------------------------
-- Referrals: a free month for the referrer when someone they invited first pays.
-- ---------------------------------------------------------------------------
create table public.referral_rewards (
  referee_id uuid primary key references public.profiles (id) on delete cascade,
  referrer_id uuid not null references public.profiles (id) on delete cascade,
  payment_id uuid references public.payments (id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.referral_rewards enable row level security;
create policy "referrer: read rewards" on public.referral_rewards
  for select using (referrer_id = auth.uid());

-- Called once after sign-up with the code from the invite link.
create function public.claim_referral(code text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  referrer uuid;
begin
  select id into referrer from public.profiles where referral_code = lower(code);
  if referrer is null or referrer = auth.uid() then
    return false;
  end if;
  -- Only fresh accounts that haven't been referred yet.
  update public.profiles
  set referred_by = referrer
  where id = auth.uid() and referred_by is null and created_at > now() - interval '1 day';
  return found;
end;
$$;

create function public.referral_count()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'signed_up', (select count(*) from public.profiles where referred_by = auth.uid()),
    'rewarded', (select count(*) from public.referral_rewards where referrer_id = auth.uid())
  );
$$;

-- Give the referrer a free month of their plan (Freelancer if they're on Free).
create function public.reward_referrer(p_payment uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  pay public.payments;
  referee uuid;
  referrer uuid;
  w public.workspaces;
  target public.plan;
begin
  select * into pay from public.payments where id = p_payment and status = 'paid';
  if not found then return; end if;
  select owner_id into referee from public.workspaces where id = pay.workspace_id;
  select referred_by into referrer from public.profiles where id = referee;
  if referrer is null then return; end if;

  insert into public.referral_rewards (referee_id, referrer_id, payment_id)
  values (referee, referrer, pay.id)
  on conflict (referee_id) do nothing;
  if not found then return; end if;

  select * into w from public.workspaces where owner_id = referrer order by created_at limit 1 for update;
  if not found then return; end if;
  target := case when w.plan = 'free' then 'freelancer'::public.plan else w.plan end;

  update public.workspaces
  set plan = target,
      plan_expires_at = greatest(coalesce(w.plan_expires_at, now()), now()) + interval '30 days',
      credits_left = case when w.plan = 'free' then public.plan_allowance(target) else credits_left end,
      credits_reset_at = case when w.plan = 'free' then now() + interval '1 month' else credits_reset_at end
  where id = w.id;
end;
$$;

-- Hook the reward into payment fulfilment.
create or replace function public.fulfil_payment(p_txn_ref text, p_amount integer, p_response jsonb)
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

  perform public.reward_referrer(p.id);
  return true;
end;
$$;

revoke execute on function public.fulfil_payment(text, integer, jsonb) from public, anon, authenticated;
grant execute on function public.fulfil_payment(text, integer, jsonb) to service_role;
revoke execute on function public.reward_referrer(uuid) from public, anon, authenticated;

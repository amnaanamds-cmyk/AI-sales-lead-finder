-- LeadNama core schema (docs/PROJECT.md section 7).
--
-- Google Places terms: we keep only `place_id` for each lead. Name, phone, website,
-- rating etc. are fetched live from Google and never stored permanently.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.plan as enum ('free', 'freelancer', 'agency');
create type public.pitch_language as enum ('en', 'ur', 'roman_ur');
create type public.pitch_tone as enum ('formal', 'friendly');
create type public.pipeline_stage as enum ('new', 'contacted', 'replied', 'meeting', 'won', 'lost');
create type public.payment_method as enum ('jazzcash', 'easypaisa', 'safepay');
create type public.payment_status as enum ('pending', 'paid', 'failed', 'refunded');

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

-- "users" in the spec. Supabase owns auth.users, so app data lives here.
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text,
  email text,
  service_type text,
  language_pref public.pitch_language not null default 'en',
  created_at timestamptz not null default now()
);

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  plan public.plan not null default 'free',
  credits_left integer not null default 20 check (credits_left >= 0),
  created_at timestamptz not null default now()
);
create index workspaces_owner_id_idx on public.workspaces (owner_id);

create table public.searches (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  query text not null,
  city text not null,
  result_count integer not null default 0,
  created_at timestamptz not null default now()
);
create index searches_workspace_id_idx on public.searches (workspace_id, created_at desc);

create table public.leads (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  search_id uuid references public.searches (id) on delete set null,
  place_id text not null,
  created_at timestamptz not null default now(),
  unique (workspace_id, place_id)
);

create table public.lead_checks (
  lead_id uuid primary key references public.leads (id) on delete cascade,
  has_site boolean not null default false,
  site_live boolean,
  ssl boolean,
  mobile_ok boolean,
  socials jsonb not null default '{}'::jsonb,
  checked_at timestamptz not null default now()
);

create table public.lead_scores (
  lead_id uuid primary key references public.leads (id) on delete cascade,
  score smallint not null check (score between 0 and 100),
  reason text not null,
  main_gap text,
  scored_at timestamptz not null default now()
);

create table public.pitches (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads (id) on delete cascade,
  language public.pitch_language not null,
  tone public.pitch_tone not null,
  text text not null,
  created_at timestamptz not null default now()
);
create index pitches_lead_id_idx on public.pitches (lead_id);

create table public.pipeline (
  lead_id uuid primary key references public.leads (id) on delete cascade,
  stage public.pipeline_stage not null default 'new',
  notes text,
  next_followup date,
  updated_at timestamptz not null default now()
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  amount integer not null check (amount > 0), -- PKR
  method public.payment_method not null,
  status public.payment_status not null default 'pending',
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Access helpers
-- ---------------------------------------------------------------------------

-- Single place to widen access when team seats arrive (v2).
create function public.is_workspace_member(ws uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.workspaces w
    where w.id = ws and w.owner_id = auth.uid()
  );
$$;

create function public.is_lead_member(l uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.leads
    where id = l and public.is_workspace_member(workspace_id)
  );
$$;

-- Atomically take up to `requested` credits. Returns how many were granted.
create function public.consume_credits(ws uuid, requested integer)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  granted integer;
begin
  if not public.is_workspace_member(ws) then
    raise exception 'not a member of workspace %', ws;
  end if;

  select least(credits_left, greatest(requested, 0)) into granted
  from public.workspaces
  where id = ws
  for update;

  update public.workspaces
  set credits_left = credits_left - granted
  where id = ws;

  return granted;
end;
$$;

-- Create a profile and a free workspace for every new sign-up.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.email
  );
  insert into public.workspaces (owner_id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.searches enable row level security;
alter table public.leads enable row level security;
alter table public.lead_checks enable row level security;
alter table public.lead_scores enable row level security;
alter table public.pitches enable row level security;
alter table public.pipeline enable row level security;
alter table public.payments enable row level security;

create policy "own profile: read" on public.profiles
  for select using (id = auth.uid());
create policy "own profile: update" on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

-- Plan and credits are changed only by security-definer functions / service role.
create policy "member: read workspace" on public.workspaces
  for select using (public.is_workspace_member(id));

create policy "member: all searches" on public.searches
  for all using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

create policy "member: all leads" on public.leads
  for all using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

create policy "member: all lead_checks" on public.lead_checks
  for all using (public.is_lead_member(lead_id))
  with check (public.is_lead_member(lead_id));

create policy "member: all lead_scores" on public.lead_scores
  for all using (public.is_lead_member(lead_id))
  with check (public.is_lead_member(lead_id));

create policy "member: all pitches" on public.pitches
  for all using (public.is_lead_member(lead_id))
  with check (public.is_lead_member(lead_id));

create policy "member: all pipeline" on public.pipeline
  for all using (public.is_lead_member(lead_id))
  with check (public.is_lead_member(lead_id));

-- Payments are written by the payment webhook (service role) only.
create policy "member: read payments" on public.payments
  for select using (public.is_workspace_member(workspace_id));

-- FidelSub Supabase Schema & Row Level Security
-- Run this SQL in your Supabase Dashboard -> SQL Editor

create extension if not exists pgcrypto;

-- 1. User Profiles, Usage & Pro Plan Tracking
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  plan_type text not null default 'free' check (plan_type in ('free', 'monthly', 'yearly', 'lifetime')),
  videos_used integer not null default 0 check (videos_used >= 0),
  is_pro boolean not null default false,
  pro_expires_at timestamptz null,
  payment_status text not null default 'none' check (payment_status in ('none', 'pending', 'approved')),
  telebirr_reference text null,
  requested_plan text null check (requested_plan in ('monthly', 'yearly', 'lifetime')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. Saved Subtitle History
create table if not exists public.subtitles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  file_name text not null,
  media_kind text not null check (media_kind in ('video', 'audio')),
  source_mode text not null default 'auto',
  detected_language text null,
  cues jsonb not null default '[]'::jsonb,
  srt_content text not null,
  cue_count integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists subtitles_user_created_idx
  on public.subtitles (user_id, created_at desc);

-- 3. Auto-create profile row when a new user signs up via Email/Password or Google OAuth
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, plan_type, videos_used, is_pro, pro_expires_at, payment_status)
  values (
    new.id,
    coalesce(new.email, ''),
    'free',
    0,
    false,
    null,
    'none'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 4. Enable Row Level Security
alter table public.profiles enable row level security;
alter table public.subtitles enable row level security;

-- Helper: Studio owner check by verified JWT email
create or replace function public.is_studio_owner()
returns boolean
language sql
stable
as $$
  select lower(coalesce(auth.jwt() ->> 'email', '')) = 'djelawebshet@gmail.com';
$$;

-- Profiles RLS Policies
drop policy if exists "Users can view own profile or owner views all" on public.profiles;
create policy "Users can view own profile or owner views all"
  on public.profiles
  for select
  using (auth.uid() = id or public.is_studio_owner());

drop policy if exists "Users can insert own default profile" on public.profiles;
create policy "Users can insert own default profile"
  on public.profiles
  for insert
  with check (
    auth.uid() = id
    and plan_type = 'free'
    and videos_used = 0
    and is_pro = false
    and pro_expires_at is null
    and payment_status = 'none'
  );

drop policy if exists "Users can update safe profile fields or expire own plan" on public.profiles;
create policy "Users can update safe profile fields or expire own plan"
  on public.profiles
  for update
  using (auth.uid() = id or public.is_studio_owner())
  with check (
    public.is_studio_owner()
    or (
      auth.uid() = id
      and (
        -- Users cannot self-activate Pro; only keep existing Pro state or downgrade expired plans to free
        is_pro = false
        or (
          is_pro = (select p.is_pro from public.profiles p where p.id = auth.uid())
          and plan_type = (select p.plan_type from public.profiles p where p.id = auth.uid())
          and pro_expires_at is not distinct from (select p.pro_expires_at from public.profiles p where p.id = auth.uid())
        )
      )
      and payment_status in ('none', 'pending')
    )
  );

-- Subtitles RLS Policies
drop policy if exists "Users can view own subtitles" on public.subtitles;
create policy "Users can view own subtitles"
  on public.subtitles
  for select
  using (auth.uid() = user_id or public.is_studio_owner());

drop policy if exists "Users can insert own subtitles" on public.subtitles;
create policy "Users can insert own subtitles"
  on public.subtitles
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own subtitles" on public.subtitles;
create policy "Users can delete own subtitles"
  on public.subtitles
  for delete
  using (auth.uid() = user_id);

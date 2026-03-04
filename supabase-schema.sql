-- Supabase schema for Reconnect - auth + workspaces (multi-tenant)
-- This file is meant to be executed in Supabase SQL editor or as a migration.
-- It assumes the default Supabase `auth.users` table already exists.

-- PROFILES --------------------------------------------------------------------

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "Users can view own profile" on public.profiles;
create policy "Users can view own profile"
  on public.profiles
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own profile" on public.profiles;
create policy "Users can insert own profile"
  on public.profiles
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
  on public.profiles
  for update
  using (auth.uid() = user_id);


-- WORKSPACES ------------------------------------------------------------------

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique,
  plan text not null default 'starter', -- starter | growth | pro (text for now)
  created_at timestamptz not null default now()
);

alter table public.workspaces enable row level security;


-- WORKSPACE MEMBERS -----------------------------------------------------------

create type public.workspace_role as enum ('owner', 'admin', 'member');

create table if not exists public.workspace_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.workspace_role not null default 'member',
  created_at timestamptz not null default now(),
  unique (workspace_id, user_id)
);

alter table public.workspace_members enable row level security;


-- RLS POLICIES FOR WORKSPACES AND MEMBERS ------------------------------------

-- A user can see a workspace if they are a member of it.
drop policy if exists "Members can view their workspaces" on public.workspaces;
create policy "Members can view their workspaces"
  on public.workspaces
  for select
  using (
    exists (
      select 1
      from public.workspace_members wm
      where wm.workspace_id = workspaces.id
        and wm.user_id = auth.uid()
    )
  );

-- A user can create a workspace; they will be owner via trigger below.
drop policy if exists "Authenticated users can create workspaces" on public.workspaces;
create policy "Authenticated users can create workspaces"
  on public.workspaces
  for insert
  with check (auth.role() = 'authenticated');


-- Members: users can see their own membership rows.
drop policy if exists "Users can view own memberships" on public.workspace_members;
create policy "Users can view own memberships"
  on public.workspace_members
  for select
  using (user_id = auth.uid());

-- Only owners/admins of a workspace can manage memberships.
drop policy if exists "Owners/admins manage memberships" on public.workspace_members;
create policy "Owners/admins manage memberships"
  on public.workspace_members
  for all
  using (
    exists (
      select 1
      from public.workspace_members wm
      where wm.workspace_id = workspace_members.workspace_id
        and wm.user_id = auth.uid()
        and wm.role in ('owner', 'admin')
    )
  )
  with check (
    exists (
      select 1
      from public.workspace_members wm
      where wm.workspace_id = workspace_members.workspace_id
        and wm.user_id = auth.uid()
        and wm.role in ('owner', 'admin')
    )
  );


-- BOOTSTRAP: CREATE OWNER MEMBERSHIP ON WORKSPACE INSERT ---------------------

create or replace function public.handle_new_workspace()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return new;
  end if;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (new.id, auth.uid(), 'owner')
  on conflict (workspace_id, user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_workspace_created on public.workspaces;
create trigger on_workspace_created
  after insert on public.workspaces
  for each row
  execute procedure public.handle_new_workspace();


-- FUTURE RELATIONSHIPS (CONTACTS / CAMPAIGNS / MESSAGES / RESPONSES) ---------
-- These are only placeholders to document how multi-tenant isolation will work.
-- Actual tables can be created in later iterations.

-- example:
-- create table if not exists public.contacts (
--   id uuid primary key default gen_random_uuid(),
--   workspace_id uuid not null references public.workspaces (id) on delete cascade,
--   name text,
--   phone text not null,
--   created_at timestamptz not null default now()
-- );

-- alter table public.contacts enable row level security;
-- create policy "Workspace members can manage contacts"
--   on public.contacts
--   for all
--   using (
--     exists (
--       select 1
--       from public.workspace_members wm
--       where wm.workspace_id = contacts.workspace_id
--         and wm.user_id = auth.uid()
--     )
--   )
--   with check (
--     exists (
--       select 1
--       from public.workspace_members wm
--       where wm.workspace_id = contacts.workspace_id
--         and wm.user_id = auth.uid()
--     )
--   );


create extension if not exists pgcrypto;

create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references public.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  institution text not null default 'Stanford University',
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.workspace_memberships (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  role text not null check (role in ('owner', 'editor', 'viewer')),
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create table public.terms_acceptances (
  user_id uuid not null references public.users(id) on delete cascade,
  terms_version text not null,
  accepted_at timestamptz not null default now(),
  primary key (user_id, terms_version)
);

create table public.workspace_snapshots (
  workspace_id uuid primary key references public.workspaces(id) on delete cascade,
  version bigint not null default 1 check (version > 0),
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

create table public.workspace_versions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  version bigint not null check (version > 0),
  payload jsonb not null,
  actor_user_id uuid references public.users(id) on delete set null,
  idempotency_key text,
  created_at timestamptz not null default now(),
  unique (workspace_id, version),
  unique (workspace_id, idempotency_key)
);

create table public.demo_sessions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null unique references public.workspaces(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  session_hash text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  reset_at timestamptz,
  check (expires_at > created_at)
);

create index workspace_memberships_user_idx on public.workspace_memberships(user_id);
create index workspace_versions_workspace_created_idx on public.workspace_versions(workspace_id, created_at desc);
create index demo_sessions_expiry_idx on public.demo_sessions(expires_at);

create or replace function public.is_workspace_member(target_workspace_id uuid, allowed_roles text[] default array['owner', 'editor', 'viewer'])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workspace_memberships membership
    where membership.workspace_id = target_workspace_id
      and membership.user_id = auth.uid()
      and membership.role = any(allowed_roles)
  )
$$;

alter table public.users enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_memberships enable row level security;
alter table public.terms_acceptances enable row level security;
alter table public.workspace_snapshots enable row level security;
alter table public.workspace_versions enable row level security;
alter table public.demo_sessions enable row level security;

create policy users_read_self on public.users for select using (id = auth.uid());
create policy users_update_self on public.users for update using (id = auth.uid()) with check (id = auth.uid());
create policy workspaces_read_members on public.workspaces for select using (public.is_workspace_member(id));
create policy workspaces_update_editors on public.workspaces for update using (public.is_workspace_member(id, array['owner', 'editor'])) with check (public.is_workspace_member(id, array['owner', 'editor']));
create policy memberships_read_members on public.workspace_memberships for select using (public.is_workspace_member(workspace_id));
create policy memberships_manage_owner on public.workspace_memberships for all using (public.is_workspace_member(workspace_id, array['owner'])) with check (public.is_workspace_member(workspace_id, array['owner']));
create policy terms_read_self on public.terms_acceptances for select using (user_id = auth.uid());
create policy terms_insert_self on public.terms_acceptances for insert with check (user_id = auth.uid());
create policy snapshots_read_members on public.workspace_snapshots for select using (public.is_workspace_member(workspace_id));
create policy snapshots_update_editors on public.workspace_snapshots for update using (public.is_workspace_member(workspace_id, array['owner', 'editor'])) with check (public.is_workspace_member(workspace_id, array['owner', 'editor']));
create policy versions_read_members on public.workspace_versions for select using (public.is_workspace_member(workspace_id));
create policy versions_insert_editors on public.workspace_versions for insert with check (public.is_workspace_member(workspace_id, array['owner', 'editor']));
create policy demo_sessions_read_self on public.demo_sessions for select using (user_id = auth.uid() and expires_at > now());

create or replace function public.commit_workspace_snapshot(
  target_workspace_id uuid,
  expected_version bigint,
  next_payload jsonb,
  mutation_idempotency_key text
)
returns bigint
language plpgsql
security invoker
set search_path = public
as $$
declare
  committed_version bigint;
begin
  update public.workspace_snapshots
  set version = version + 1,
      payload = next_payload,
      updated_at = now()
  where workspace_id = target_workspace_id
    and version = expected_version
  returning version into committed_version;

  if committed_version is null then
    raise exception 'Workspace version conflict' using errcode = '40001';
  end if;

  insert into public.workspace_versions (workspace_id, version, payload, actor_user_id, idempotency_key)
  values (target_workspace_id, committed_version, next_payload, auth.uid(), mutation_idempotency_key)
  on conflict (workspace_id, idempotency_key) do nothing;

  return committed_version;
end
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email, display_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'full_name', split_part(coalesce(new.email, ''), '@', 1)))
  on conflict (id) do nothing;
  return new;
end
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

create or replace function public.delete_expired_demo_workspaces()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted_count integer;
begin
  with expired as (
    delete from public.workspaces workspace
    using public.demo_sessions session
    where workspace.id = session.workspace_id
      and session.expires_at <= now()
    returning workspace.id
  )
  select count(*) into deleted_count from expired;
  return deleted_count;
end
$$;

revoke all on function public.delete_expired_demo_workspaces() from public;
grant execute on function public.commit_workspace_snapshot(uuid, bigint, jsonb, text) to authenticated;

alter table public.workspaces
add column if not exists onboarding_required boolean not null default false,
add column if not exists is_permanent_demo boolean not null default false;

create or replace function public.is_demo_identity()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select lower(coalesce(auth.jwt() ->> 'email', '')) = 'demo@coursecontext.app'
$$;

create or replace function public.create_personal_workspace(
  workspace_title text,
  initial_payload jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  created_workspace_id uuid := gen_random_uuid();
  normalized_payload jsonb;
begin
  if current_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if exists (select 1 from public.workspace_memberships where user_id = current_user_id) then
    raise exception 'A workspace already exists for this account' using errcode = '23505';
  end if;

  normalized_payload := jsonb_set(
    jsonb_set(initial_payload, '{id}', to_jsonb(created_workspace_id::text), true),
    '{ownerUserId}', to_jsonb(current_user_id::text), true
  );

  insert into public.workspaces (id, owner_user_id, title, institution, is_demo, is_permanent_demo, onboarding_required)
  values (created_workspace_id, current_user_id, left(workspace_title, 120), 'Stanford University', public.is_demo_identity(), public.is_demo_identity(), false);

  insert into public.workspace_memberships (workspace_id, user_id, role)
  values (created_workspace_id, current_user_id, 'owner');

  insert into public.workspace_snapshots (workspace_id, version, payload)
  values (created_workspace_id, 1, normalized_payload);

  insert into public.workspace_versions (workspace_id, version, payload, actor_user_id, idempotency_key)
  values (created_workspace_id, 1, normalized_payload, current_user_id, 'ACCOUNT-ONBOARDING');

  return created_workspace_id;
end
$$;

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
  update public.workspace_snapshots snapshot
  set version = snapshot.version + 1,
      payload = next_payload,
      updated_at = now()
  from public.workspaces workspace
  where snapshot.workspace_id = target_workspace_id
    and workspace.id = snapshot.workspace_id
    and workspace.onboarding_required = false
    and snapshot.version = expected_version
  returning snapshot.version into committed_version;

  if committed_version is null then
    raise exception 'Workspace version conflict or onboarding required' using errcode = '40001';
  end if;

  insert into public.workspace_versions (workspace_id, version, payload, actor_user_id, idempotency_key)
  values (target_workspace_id, committed_version, next_payload, auth.uid(), mutation_idempotency_key)
  on conflict (workspace_id, idempotency_key) do nothing;

  return committed_version;
end
$$;

create or replace function public.reset_demo_workspace(
  reset_payload jsonb,
  mutation_idempotency_key text
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  target_workspace_id uuid;
  current_version bigint;
  next_version bigint;
  normalized_payload jsonb;
begin
  if current_user_id is null or not public.is_demo_identity() then
    raise exception 'Demo account required' using errcode = '42501';
  end if;

  select workspace.id, snapshot.version
  into target_workspace_id, current_version
  from public.workspaces workspace
  join public.workspace_memberships membership on membership.workspace_id = workspace.id
  join public.workspace_snapshots snapshot on snapshot.workspace_id = workspace.id
  where membership.user_id = current_user_id
    and membership.role = 'owner'
    and workspace.is_permanent_demo = true
  limit 1
  for update of snapshot;

  if target_workspace_id is null then
    raise exception 'Demo workspace required' using errcode = '42501';
  end if;

  next_version := current_version + 1;
  normalized_payload := jsonb_set(
    jsonb_set(
      jsonb_set(reset_payload, '{id}', to_jsonb(target_workspace_id::text), true),
      '{ownerUserId}', to_jsonb(current_user_id::text), true
    ),
    '{version}', to_jsonb(next_version), true
  );

  update public.workspace_snapshots
  set version = next_version,
      payload = normalized_payload,
      updated_at = now()
  where workspace_id = target_workspace_id;

  update public.workspaces
  set title = 'Demo workspace',
      onboarding_required = true,
      updated_at = now()
  where id = target_workspace_id;

  insert into public.workspace_versions (workspace_id, version, payload, actor_user_id, idempotency_key)
  values (target_workspace_id, next_version, normalized_payload, current_user_id, mutation_idempotency_key);

  return next_version;
end
$$;

create or replace function public.complete_demo_onboarding(
  workspace_title text,
  initial_payload jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  target_workspace_id uuid;
  current_version bigint;
  next_version bigint;
  normalized_payload jsonb;
begin
  if current_user_id is null or not public.is_demo_identity() then
    raise exception 'Demo account required' using errcode = '42501';
  end if;

  select workspace.id, snapshot.version
  into target_workspace_id, current_version
  from public.workspaces workspace
  join public.workspace_memberships membership on membership.workspace_id = workspace.id
  join public.workspace_snapshots snapshot on snapshot.workspace_id = workspace.id
  where membership.user_id = current_user_id
    and membership.role = 'owner'
    and workspace.is_permanent_demo = true
    and workspace.onboarding_required = true
  limit 1
  for update of snapshot;

  if target_workspace_id is null then
    raise exception 'Demo onboarding is not available' using errcode = '42501';
  end if;

  next_version := current_version + 1;
  normalized_payload := jsonb_set(
    jsonb_set(
      jsonb_set(initial_payload, '{id}', to_jsonb(target_workspace_id::text), true),
      '{ownerUserId}', to_jsonb(current_user_id::text), true
    ),
    '{version}', to_jsonb(next_version), true
  );

  update public.workspace_snapshots
  set version = next_version,
      payload = normalized_payload,
      updated_at = now()
  where workspace_id = target_workspace_id;

  update public.workspaces
  set title = left(workspace_title, 120),
      onboarding_required = false,
      updated_at = now()
  where id = target_workspace_id;

  insert into public.workspace_versions (workspace_id, version, payload, actor_user_id, idempotency_key)
  values (target_workspace_id, next_version, normalized_payload, current_user_id, 'DEMO-ONBOARDING-' || next_version::text);

  return target_workspace_id;
end
$$;

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
      and workspace.is_permanent_demo = false
      and session.expires_at <= now()
    returning workspace.id
  )
  select count(*) into deleted_count from expired;
  return deleted_count;
end
$$;

revoke all on function public.is_demo_identity() from public;
revoke update on table public.workspaces from authenticated;
grant update (title, institution) on table public.workspaces to authenticated;
revoke all on function public.commit_workspace_snapshot(uuid, bigint, jsonb, text) from public;
revoke all on function public.reset_demo_workspace(jsonb, text) from public;
revoke all on function public.complete_demo_onboarding(text, jsonb) from public;
revoke all on function public.delete_expired_demo_workspaces() from public;
grant execute on function public.commit_workspace_snapshot(uuid, bigint, jsonb, text) to authenticated;
grant execute on function public.reset_demo_workspace(jsonb, text) to authenticated;
grant execute on function public.complete_demo_onboarding(text, jsonb) to authenticated;

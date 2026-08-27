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

  insert into public.workspaces (id, owner_user_id, title, institution)
  values (created_workspace_id, current_user_id, left(workspace_title, 120), 'Stanford University');

  insert into public.workspace_memberships (workspace_id, user_id, role)
  values (created_workspace_id, current_user_id, 'owner');

  insert into public.workspace_snapshots (workspace_id, version, payload)
  values (created_workspace_id, 1, normalized_payload);

  insert into public.workspace_versions (workspace_id, version, payload, actor_user_id, idempotency_key)
  values (created_workspace_id, 1, normalized_payload, current_user_id, 'ACCOUNT-ONBOARDING');

  return created_workspace_id;
end
$$;

revoke all on function public.create_personal_workspace(text, jsonb) from public;
grant execute on function public.create_personal_workspace(text, jsonb) to authenticated;

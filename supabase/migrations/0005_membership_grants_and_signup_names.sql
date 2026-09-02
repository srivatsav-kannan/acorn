-- Two tightenings found in review before judging.
--
-- Memberships: no feature edits memberships yet, but the owner policy plus a
-- full write grant let an owner delete or demote their own row and lock
-- themselves out of a workspace forever. Until collaboration ships, the
-- authenticated role can only read memberships. The onboarding and demo
-- functions that create memberships run as their definer and are unaffected.

drop policy if exists memberships_manage_owner on public.workspace_memberships;
revoke insert, update, delete on table public.workspace_memberships from authenticated;

-- Signup names: the signup form sends the name as raw_user_meta_data.name,
-- while the profile trigger read full_name and always fell back to the email
-- local part. Read both keys, and cap the stored value, since metadata is
-- caller-controlled and unbounded.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email, display_name)
  values (
    new.id,
    new.email,
    left(coalesce(nullif(trim(new.raw_user_meta_data ->> 'name'), ''), nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), split_part(coalesce(new.email, ''), '@', 1)), 200)
  )
  on conflict (id) do nothing;
  return new;
end
$$;

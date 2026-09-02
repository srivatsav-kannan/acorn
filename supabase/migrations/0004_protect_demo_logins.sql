-- The judging credentials are shared. Anyone holding them could otherwise
-- change the password or email and lock every other judge out, and the app's
-- own account card is only a courtesy: the auth API is reachable without it.
-- The guard therefore lives on auth.users itself and fires only when a
-- protected login's email or password would actually change. Sign-ins,
-- recovery stamps, and session bookkeeping still update the row freely.

create or replace function public.protect_demo_logins()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if lower(old.email) in ('julia.reyes@acorndemo.app', 'demo@coursecontext.app')
     and (new.email is distinct from old.email
          or new.encrypted_password is distinct from old.encrypted_password
          or coalesce(new.email_change, '') <> coalesce(old.email_change, '')) then
    raise exception 'This demo account keeps its login details.';
  end if;
  return new;
end
$$;

revoke execute on function public.protect_demo_logins() from anon, authenticated;

drop trigger if exists protect_demo_logins on auth.users;
create trigger protect_demo_logins
before update on auth.users
for each row
execute function public.protect_demo_logins();

-- The profile page hides its login-details card for demo workspaces.
update public.workspaces
set is_demo = true
where id in (
  select m.workspace_id
  from public.workspace_memberships m
  join auth.users u on u.id = m.user_id
  where lower(u.email) = 'julia.reyes@acorndemo.app'
);

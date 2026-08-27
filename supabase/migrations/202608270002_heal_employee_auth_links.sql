-- Links that never formed, healed at the only moment they can be: sign-in.
--
-- `link_auth_user` attaches an Auth account to its employee profile, but it
-- fires on insert into auth.users and matches by email, so it only works when
-- the profile already existed under exactly that address. Create the account
-- first, correct a typo in the email afterwards, or re-add someone whose
-- account outlived their profile, and nothing links the two.
--
-- An unlinked profile is not a cosmetic problem. `current_app_user_id()` finds
-- the employee by `auth_user_id`, so the person authenticates successfully and
-- is then told their account is not linked to an active employee profile — and
-- `activated_at`, which is stamped by the same key, stays null, so they also
-- read as Pending forever despite signing in. One missing link, two symptoms.

create or replace function public.stamp_user_activation() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.last_sign_in_at is not null
     and (old.last_sign_in_at is null or old.last_sign_in_at is distinct from new.last_sign_in_at) then
    -- Adopt an unlinked profile by email first, so the stamp below has
    -- something to land on. `not exists` keeps this from colliding with the
    -- unique `auth_user_id`: an account already spoken for is left alone
    -- rather than raising inside a trigger, which would fail the sign-in.
    update public.users u
      set auth_user_id = new.id
      where u.auth_user_id is null
        and u.deleted_at is null
        and lower(u.email) = lower(new.email)
        and not exists (
          select 1 from public.users x where x.auth_user_id = new.id
        );
    update public.users
      set activated_at = coalesce(activated_at, new.last_sign_in_at)
      where auth_user_id = new.id and activated_at is null;
  end if;
  return new;
end;
$$;

-- The same repair, once, for links already missing. An account that has signed
-- in also gets its activation stamped from that history; one that never has
-- stays Pending, which is then the truth rather than an artefact.
update public.users u
set auth_user_id = a.id,
    activated_at = coalesce(u.activated_at, a.last_sign_in_at)
from auth.users a
where u.auth_user_id is null
  and u.deleted_at is null
  and lower(a.email) = lower(u.email)
  and not exists (select 1 from public.users x where x.auth_user_id = a.id);

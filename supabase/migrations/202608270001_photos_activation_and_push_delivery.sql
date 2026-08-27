-- Three things the client asked for after the first week of real use:
--   1. employee photos, because two owners share initials and avatar colour;
--   2. a "pending" employee state, because an account nobody has signed into
--      yet has been reading as Active since launch;
--   3. push delivery for the notifications this schema already writes, so a
--      job assignment reaches a phone instead of only the in-app bell.

-- 1. Employee photos ---------------------------------------------------------

alter table public.users add column if not exists avatar_path text;

-- Private, like job-photos: a headshot is staff PII, and the app already knows
-- how to hand out signed URLs. 5 MB is well above a phone camera photo scaled
-- for an avatar and well below what would make the directory slow to load.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('employee-photos', 'employee-photos', false, 5242880,
        array['image/jpeg', 'image/png', 'image/webp', 'image/heic'])
on conflict (id) do nothing;

drop policy if exists employee_photo_scoped_read on storage.objects;
drop policy if exists employee_photo_scoped_write on storage.objects;
drop policy if exists employee_photo_scoped_delete on storage.objects;

-- Photos are filed under the employee's own id, so "may I see this photo"
-- reduces to "may I see this employee" — a question `users_scoped_read`
-- already answers. Row-level security applies inside this subquery, so a
-- driver, who can read only their own row, can read only their own photo.
create policy employee_photo_scoped_read on storage.objects for select to authenticated
using (
  bucket_id = 'employee-photos'
  and exists (select 1 from public.users u where u.id = (storage.foldername(name))[1])
);
-- Writes are the administrator's, plus each person on their own photo. The
-- extension check mirrors the bucket's MIME list: `allowed_mime_types` trusts
-- the client-declared content type, and this does not.
create policy employee_photo_scoped_write on storage.objects for insert to authenticated
with check (
  bucket_id = 'employee-photos'
  and lower(storage.extension(name)) = any (array['jpg', 'jpeg', 'png', 'webp', 'heic'])
  and (
    public.current_access_role() = 'admin'
    or (storage.foldername(name))[1] = public.current_app_user_id()
  )
);
create policy employee_photo_scoped_delete on storage.objects for delete to authenticated
using (
  bucket_id = 'employee-photos'
  and (
    public.current_access_role() = 'admin'
    or (storage.foldername(name))[1] = public.current_app_user_id()
  )
);

-- 2. Pending until they have actually signed in ------------------------------
--
-- Deliberately not a third value in `employee_status`: every policy in this
-- schema keys off status = 'active', and a pending hire is an active employee
-- who simply has not signed in yet — adding a state would have quietly changed
-- what those policies mean. This records the fact instead and lets the app
-- render it, so authorization is untouched.
alter table public.users add column if not exists activated_at timestamptz;

comment on column public.users.activated_at is
  'First successful sign-in. Null means the account exists but has never been used — shown as Pending.';

-- Backfill: anyone who has ever signed in is activated, dated to that sign-in.
update public.users u
set activated_at = a.last_sign_in_at
from auth.users a
where a.id = u.auth_user_id
  and a.last_sign_in_at is not null
  and u.activated_at is null;

create or replace function public.stamp_user_activation() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.last_sign_in_at is not null
     and (old.last_sign_in_at is null or old.last_sign_in_at is distinct from new.last_sign_in_at) then
    update public.users
      set activated_at = coalesce(activated_at, new.last_sign_in_at)
      where auth_user_id = new.id and activated_at is null;
  end if;
  return new;
end;
$$;

drop trigger if exists stamp_user_activation_after_update on auth.users;
create trigger stamp_user_activation_after_update
after update of last_sign_in_at on auth.users
for each row execute function public.stamp_user_activation();

-- 3. Push delivery bookkeeping ----------------------------------------------
--
-- Every notification this schema writes — job assigned, dry run logged,
-- pre-trip failed, driver status changed — is a candidate for a phone alert.
-- Marking each row as it goes out is what keeps a second delivery pass, or two
-- dispatchers' browsers firing at once, from pushing the same alert twice.
alter table public.notifications add column if not exists pushed_at timestamptz;

create index if not exists notifications_pending_push_idx
  on public.notifications(created_at)
  where pushed_at is null;

-- Everything that already existed predates push delivery. Left unmarked, the
-- first delivery pass would try to push the entire backlog at once.
update public.notifications set pushed_at = created_at where pushed_at is null;

-- 4. Audit vocabulary --------------------------------------------------------
--
-- Recreated in full rather than patched: the function validates the action name
-- against a fixed list, so the list is the function.
create or replace function public.audit_admin_action(target_user_id text, admin_action text)
returns void language plpgsql security definer set search_path='' as $$
begin
  if not public.admin_mfa_verified() then raise exception 'Administrator MFA required'; end if;
  if admin_action not in(
    'invite_created',
    'password_reset_initiated',
    'temporary_password_issued',
    'status_active',
    'status_inactive',
    'access_role_changed',
    'permissions_changed',
    'role_changed',
    'email_changed',
    'name_changed',
    'phone_changed',
    'employee_id_changed',
    'photo_changed'
  ) then raise exception 'Unsupported administrative action'; end if;
  perform public.write_audit('users', target_user_id, admin_action, null, null, null);
end;
$$;

-- Ensure named company/application owners always retain full administrator access.
-- Auth accounts may be invited/created before or after this migration; profiles
-- are linked by email whenever the matching auth.users row exists.

create or replace function public.enforce_owner_profile_access()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  old_owner boolean := tg_op = 'UPDATE' and lower(old.email) in ('amarshall@sswsco.com', 'tehronporter@gmail.com');
  new_owner boolean := lower(new.email) in ('amarshall@sswsco.com', 'tehronporter@gmail.com');
begin
  if old_owner and not new_owner then
    raise exception 'Owner profile email cannot be changed';
  end if;

  if new_owner then
    new.role := 'management';
    new.access_role := 'admin';
    new.status := 'active';
    new.permission_overrides := '{}'::jsonb;
    new.deleted_at := null;
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_owner_profile_access_before_write on public.users;
create trigger enforce_owner_profile_access_before_write
before insert or update on public.users
for each row execute function public.enforce_owner_profile_access();

do $$
declare
  owner_record record;
  auth_id uuid;
  usable_auth_id uuid;
begin
  for owner_record in
    select *
    from (values
      ('owner-austin-marshall', 'OWNER-AMARSHALL', 'Austin Marshall', 'amarshall@sswsco.com', 'AM'),
      ('owner-tehron-porter', 'OWNER-TPORTER', 'Tehron Porter', 'tehronporter@gmail.com', 'TP')
    ) as owners(id, employee_id, full_name, email, initials)
  loop
    select id into auth_id from auth.users where lower(email) = lower(owner_record.email) order by created_at desc limit 1;
    usable_auth_id := null;
    if auth_id is not null and not exists (
      select 1 from public.users
      where auth_user_id = auth_id
        and lower(email) <> lower(owner_record.email)
    ) then
      usable_auth_id := auth_id;
    end if;

    if exists (select 1 from public.users where lower(email) = lower(owner_record.email)) then
      update public.users
      set employee_id = owner_record.employee_id,
          full_name = owner_record.full_name,
          phone = coalesce(nullif(phone, ''), ''),
          role = 'management',
          access_role = 'admin',
          permission_overrides = '{}'::jsonb,
          status = 'active',
          initials = owner_record.initials,
          auth_user_id = coalesce(usable_auth_id, auth_user_id),
          deleted_at = null
      where lower(email) = lower(owner_record.email);
    else
      insert into public.users(
        id,
        auth_user_id,
        employee_id,
        full_name,
        email,
        phone,
        role,
        access_role,
        permission_overrides,
        status,
        initials,
        deleted_at
      )
      values(
        owner_record.id,
        usable_auth_id,
        owner_record.employee_id,
        owner_record.full_name,
        lower(owner_record.email),
        '',
        'management',
        'admin',
        '{}'::jsonb,
        'active',
        owner_record.initials,
        null
      );
    end if;
  end loop;
end;
$$;

comment on function public.enforce_owner_profile_access() is
  'Keeps approved owner email profiles active with full administrator access.';

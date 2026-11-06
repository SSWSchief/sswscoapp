-- Delete unused employee profiles and their Auth identity together. Business
-- references are checked BEFORE deletion, including SET NULL and CASCADE FKs:
-- neither a payroll cascade nor lost job attribution is an acceptable side effect.
create function public.permanently_delete_employee(
  target_user_id text,
  confirmation_email text
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  actor text := public.current_app_user_id();
  employee public.users;
  reference record;
  has_history boolean;
begin
  if not public.admin_mfa_verified() then
    return jsonb_build_object('deleted', false, 'code', 'forbidden');
  end if;
  if target_user_id = actor then
    return jsonb_build_object('deleted', false, 'code', 'self_deletion');
  end if;

  -- Serialize deletions and lock both identities. The target lock also prevents
  -- concurrent FK inserts between the history checks and the actual delete.
  perform pg_advisory_xact_lock(hashtextextended('permanent-employee-deletion', 0));
  perform 1 from public.users where id in (actor, target_user_id) order by id for update;
  if not public.admin_mfa_verified() then
    return jsonb_build_object('deleted', false, 'code', 'forbidden');
  end if;
  select * into employee from public.users where id = target_user_id;
  if not found then
    return jsonb_build_object('deleted', false, 'code', 'employee_not_found');
  end if;
  if lower(trim(coalesce(confirmation_email, ''))) <> lower(employee.email) then
    return jsonb_build_object('deleted', false, 'code', 'confirmation_mismatch');
  end if;
  if exists(select 1 from public.protected_administrators
    where user_id = employee.id and (expires_at is null or expires_at > now())) then
    return jsonb_build_object('deleted', false, 'code', 'administrator_protected');
  end if;
  if employee.access_role = 'admin' and employee.status = 'active'
    and (select count(*) from public.users
      where access_role = 'admin' and status = 'active' and deleted_at is null) <= 1 then
    return jsonb_build_object('deleted', false, 'code', 'last_admin');
  end if;

  -- Only disposable delivery/read/membership state may cascade. New business
  -- FKs are included automatically, rather than relying on a stale table list.
  for reference in
    select c.conrelid, a.attname as column_name, b.attname as target_column,
      cardinality(c.conkey) as column_count
    from pg_catalog.pg_constraint c
    join pg_catalog.pg_class t on t.oid = c.conrelid
    join pg_catalog.pg_namespace n on n.oid = t.relnamespace
    join pg_catalog.pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
    join pg_catalog.pg_attribute b on b.attrelid = c.confrelid and b.attnum = c.confkey[1]
    where c.contype = 'f' and c.confrelid = 'public.users'::regclass
      and n.nspname = 'public'
      and t.relname not in ('protected_administrators', 'notifications',
        'push_subscriptions', 'message_channel_members', 'message_reads')
  loop
    -- Fail closed if a future schema introduces a composite employee FK.
    if reference.column_count <> 1 then
      return jsonb_build_object('deleted', false, 'code', 'employee_has_history');
    end if;
    execute format('select exists(select 1 from %s where %I::text = $1)',
      reference.conrelid::regclass, reference.column_name)
      into has_history using to_jsonb(employee)->>reference.target_column;
    if has_history then
      return jsonb_build_object('deleted', false, 'code', 'employee_has_history');
    end if;
  end loop;

  if employee.auth_user_id is not null then
    perform 1 from auth.users where id = employee.auth_user_id for update;
    if exists(select 1 from storage.objects
      where owner_id = employee.auth_user_id::text or owner = employee.auth_user_id) then
      return jsonb_build_object('deleted', false, 'code', 'employee_has_files');
    end if;
  end if;
  delete from public.protected_administrators
    where user_id = employee.id and expires_at <= now();
  delete from public.users where id = employee.id;
  -- Supabase supports deleting Auth users directly. Doing it in this transaction
  -- rolls everything back if Auth cleanup fails; no half-deleted sign-in account.
  delete from auth.users where id = employee.auth_user_id;
  perform public.write_audit('users', employee.id, 'employee_permanently_deleted',
    jsonb_build_object('employee_id', employee.employee_id, 'full_name', employee.full_name),
    null, 'Administrator confirmed permanent deletion');
  return jsonb_build_object('deleted', true);
end;
$$;
revoke all on function public.permanently_delete_employee(text,text) from public, anon, service_role;
grant execute on function public.permanently_delete_employee(text,text) to authenticated;

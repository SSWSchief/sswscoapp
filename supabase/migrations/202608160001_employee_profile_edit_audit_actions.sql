-- Allows administrators to edit an employee's name, email, phone, employee ID,
-- and operational role after the profile already exists, not just at creation.
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
    'employee_id_changed'
  ) then raise exception 'Unsupported administrative action'; end if;
  perform public.write_audit('users', target_user_id, admin_action, null, null, null);
end;
$$;

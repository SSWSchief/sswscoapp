-- Allows onboarding without email.
--
-- An administrator can now hand an employee a temporary password directly
-- instead of sending an invitation, which is what lets the platform run before
-- SMTP is configured and suits staff who do not read email during the working
-- day. That action must be auditable like every other credential event, and the
-- whitelist in `audit_admin_action` would otherwise reject it.
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
    'permissions_changed'
  ) then raise exception 'Unsupported administrative action'; end if;
  perform public.write_audit('users', target_user_id, admin_action, null, null, null);
end;
$$;

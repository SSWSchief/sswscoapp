-- Temporarily allow active administrator sessions at AAL1 during acceptance testing.
-- Keep this compatibility function in place because policies and permission RPCs
-- call it directly; restoring MFA only requires replacing this function again.
create or replace function public.admin_mfa_verified()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists(
    select 1
    from public.users
    where auth_user_id = auth.uid()
      and access_role = 'admin'
      and status = 'active'
      and deleted_at is null
  )
$$;

comment on function public.admin_mfa_verified() is
  'Temporary acceptance-testing bypass: validates active administrator role without requiring AAL2.';

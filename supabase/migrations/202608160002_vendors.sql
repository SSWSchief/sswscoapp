-- Vendors directory: outside contacts (towing, locksmith, portable toilets,
-- parts suppliers, etc.) dispatch/management can look up when an assigned
-- task needs an outside vendor. Mirrors the customers table.

create table public.vendors (
  id text primary key default gen_random_uuid()::text,
  name text not null,
  category text not null default '',
  phone text not null default '',
  email text not null default '',
  notes text not null default '',
  is_active boolean not null default true,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.vendors enable row level security;

create trigger vendors_set_updated_at before update on public.vendors for each row execute function public.set_updated_at();
create trigger vendors_audit after insert or update or delete on public.vendors for each row execute function public.audit_row_change();

create policy vendors_read on public.vendors for select to authenticated using (public.has_permission('vendors'));
create policy vendors_permission_insert on public.vendors for insert to authenticated
  with check (public.has_permission('vendors'));
create policy vendors_permission_update on public.vendors for update to authenticated
  using (public.has_permission('vendors')) with check (public.has_permission('vendors'));
create policy vendors_permission_delete on public.vendors for delete to authenticated
  using (public.has_permission('vendors'));

alter publication supabase_realtime add table public.vendors;

-- Grant dispatchers the vendors permission by default, alongside admins (who
-- already pass every key) and drivers (who remain unaffected).
create or replace function public.has_permission(permission_key text)
returns boolean language sql stable security definer set search_path = '' as $$
  with profile as(select access_role,permission_overrides from public.users where auth_user_id=auth.uid() and status='active' and deleted_at is null limit 1),
  defaults as(select access_role,case when access_role='dispatcher' then permission_key=any(array['dashboard','jobs','customers','trucks','dumpsters','vendors','time_clock','absence','messages','map','reports']) when access_role='driver' then permission_key=any(array['driver_jobs','time_clock','messages','pre_trip','sops','profile']) else false end allowed,permission_overrides from profile)
  select case when access_role='admin' then public.admin_mfa_verified() and coalesce((permission_overrides->>permission_key)::boolean,true) else coalesce((permission_overrides->>permission_key)::boolean,allowed,false) end from defaults
$$;

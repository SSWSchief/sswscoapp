-- Drivers choose where to dump a load, so they need the disposal-site
-- directory (address, hours, accepted materials, restrictions). Reading was
-- tied to the vendors permission, which the driver portal never grants, and
-- there was no per-person override that could open it. Drivers read active
-- sites only; maintaining them stays with vendors-permission staff.

-- The table was created without an explicit grant and relied on ambient
-- Supabase privileges; RLS still decides which rows and writes are allowed.
grant delete, insert, select, update on public.disposal_sites to authenticated;

drop policy if exists disposal_sites_read on public.disposal_sites;
create policy disposal_sites_read on public.disposal_sites for select to authenticated using (
  public.has_permission('vendors') or (is_active and public.has_permission('driver_jobs'))
);

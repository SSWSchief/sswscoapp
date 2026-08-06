create policy users_admin_insert on public.users for insert to authenticated
with check (public.current_access_role() = 'admin');

create policy users_admin_delete on public.users for delete to authenticated
using (public.current_access_role() = 'admin');

revoke execute on function public.write_audit(text,text,text,jsonb,jsonb,text) from authenticated;

create or replace function public.audit_admin_action(target_user_id text, admin_action text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if public.current_access_role() <> 'admin' then raise exception 'Admin access required'; end if;
  if admin_action not in ('invite_created','password_reset_initiated') then raise exception 'Unsupported administrative action'; end if;
  perform public.write_audit('users',target_user_id,admin_action,null,null,null);
end $$;
grant execute on function public.audit_admin_action(text,text) to authenticated;

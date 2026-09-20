-- Manual PTO accrual/correction ledger. Automated accrual is deliberately not
-- inferred: employment policy must define it before it can change balances.
create table public.pto_balance_adjustments (
  id text primary key default gen_random_uuid()::text,
  user_id text not null references public.users(id) on delete restrict,
  delta_hours numeric(8,2) not null check (delta_hours <> 0),
  balance_after_hours numeric(8,2) not null check (balance_after_hours >= 0),
  reason text not null check (length(trim(reason)) between 3 and 500),
  adjusted_by_id text not null references public.users(id) on delete restrict,
  created_at timestamptz not null default now()
);
create index pto_balance_adjustments_user_idx
  on public.pto_balance_adjustments(user_id, created_at desc);
alter table public.pto_balance_adjustments enable row level security;
create policy pto_balance_adjustments_read on public.pto_balance_adjustments
  for select to authenticated using (
    user_id=public.current_app_user_id() or public.admin_mfa_verified()
  );
create trigger pto_balance_adjustments_audit after insert or update or delete
  on public.pto_balance_adjustments for each row execute function public.audit_row_change();

create function public.adjust_pto_balance(target_user_id text, delta_hours numeric, adjustment_reason text)
returns public.users language plpgsql security definer set search_path='' as $$
declare actor text:=public.current_app_user_id(); changed public.users; prior numeric(8,2);
begin
  if not public.admin_mfa_verified() then raise exception 'Administrator access required'; end if;
  if delta_hours is null or delta_hours=0 or abs(delta_hours)>10000 then raise exception 'PTO adjustment is invalid'; end if;
  if length(trim(coalesce(adjustment_reason,'')))<3 then raise exception 'A PTO adjustment reason is required'; end if;
  select coalesce(pto_balance_hours,0) into prior from public.users where id=target_user_id and deleted_at is null for update;
  if prior is null then raise exception 'Employee not found'; end if;
  if prior+delta_hours<0 then raise exception 'PTO balance cannot fall below zero'; end if;
  update public.users set pto_balance_hours=prior+delta_hours,updated_at=now()
    where id=target_user_id returning * into changed;
  insert into public.pto_balance_adjustments(user_id,delta_hours,balance_after_hours,reason,adjusted_by_id)
    values(target_user_id,delta_hours,changed.pto_balance_hours,trim(adjustment_reason),actor);
  perform public.write_audit('users',target_user_id,'pto_balance_adjustment',jsonb_build_object('balance_hours',prior),jsonb_build_object('balance_hours',changed.pto_balance_hours,'delta_hours',delta_hours),trim(adjustment_reason));
  return changed;
end;
$$;
revoke all on function public.adjust_pto_balance(text,numeric,text) from public,anon;
grant execute on function public.adjust_pto_balance(text,numeric,text) to authenticated;

-- Disposal-site data is maintained before route/cost recommendations are
-- enabled. Fees and acceptance rules stay source data, never guessed.
create table public.disposal_sites (
  id text primary key default gen_random_uuid()::text,
  vendor_id text references public.vendors(id) on delete set null,
  name text not null check (length(trim(name)) between 2 and 160),
  address text not null default '',
  latitude numeric(9,6),
  longitude numeric(9,6),
  operating_hours text not null default '',
  material_rules jsonb not null default '[]'::jsonb,
  truck_restrictions text not null default '',
  estimated_wait_minutes integer not null default 0 check (estimated_wait_minutes between 0 and 1440),
  notes text not null default '',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((latitude is null and longitude is null) or (latitude between -90 and 90 and longitude between -180 and 180))
);
create trigger disposal_sites_set_updated_at before update on public.disposal_sites for each row execute function public.set_updated_at();
create trigger disposal_sites_audit after insert or update or delete on public.disposal_sites for each row execute function public.audit_row_change();
alter table public.disposal_sites enable row level security;
create policy disposal_sites_read on public.disposal_sites for select to authenticated using(public.has_permission('vendors'));
create policy disposal_sites_write on public.disposal_sites for all to authenticated using(public.has_permission('vendors')) with check(public.has_permission('vendors'));

-- Nov 10 2026, production: dispatch tapped "Mark arrived" on a job and got
-- "Selected truck is active on another job or unavailable".
--
-- reserve_job_assets treated ANY non-null trucks.current_job_id as "this truck
-- is busy". Dumpsters were fixed for the same flaw on 9/30 (only an en-route or
-- arrived job holds one), but trucks never were. A truck keeps pointing at the
-- previous job until that job is completed or cancelled through a path that
-- releases it, so one forgotten tap (the very thing the office is fixing) left
-- the truck "busy" with a finished, or abandoned, job and blocked the next one.
--
-- 1. A truck is held only by another job that is genuinely en route or arrived.
--    A pointer at a complete, cancelled, pending or deleted job is stale and is
--    taken over.
-- 2. When the office marks the status (office_override), it vouches for what
--    happened, so the truck moves to this job even if the driver never closed
--    the previous one. The earlier job keeps its own record; its later release
--    only clears the truck if the truck still points at it.
-- 3. A truck that is down, in the shop or removed is still refused, now with a
--    message that says so instead of the misleading "active on another job".

create or replace function public.reserve_job_assets(
  next_job public.jobs,
  office_override boolean default false
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  truck public.trucks;
begin
  if next_job.status not in ('en_route','arrived') then return; end if;
  if not office_override then
    perform public.assert_active_user(next_job.assigned_driver_id, 'driver');
    if next_job.assigned_driver_id is null then raise exception 'Assign a driver before starting the job'; end if;
  end if;

  if next_job.assigned_truck_id is not null then
    select * into truck from public.trucks
      where id = next_job.assigned_truck_id and deleted_at is null for update;
    if not found or truck.status <> 'in_use' then
      raise exception 'Selected truck is down, in the shop or removed';
    end if;
    if not office_override and truck.current_job_id is not null
       and truck.current_job_id <> next_job.id
       and exists(
         select 1 from public.jobs held
         where held.id = truck.current_job_id and held.deleted_at is null
           and held.status in ('en_route','arrived')
       ) then
      raise exception 'Selected truck is active on another job or unavailable';
    end if;
    update public.trucks set current_job_id=next_job.id, assigned_driver_id=next_job.assigned_driver_id,
      last_known_location=next_job.address, last_seen_at=now() where id=next_job.assigned_truck_id;
  end if;

  if next_job.assigned_dumpster_id is not null then
    perform 1 from public.dumpsters d
      where d.id=next_job.assigned_dumpster_id and d.deleted_at is null and d.status <> 'in_shop'
        and (d.current_job_id is null or d.current_job_id=next_job.id
          or not exists(
            select 1 from public.jobs held
            where held.id=d.current_job_id and held.status in ('en_route','arrived')
          ))
      for update of d;
    if not found then raise exception 'Selected dumpster is active on another job or unavailable'; end if;
    update public.dumpsters set current_job_id=next_job.id, current_customer_id=next_job.customer_id,
      current_location=next_job.address, status='out' where id=next_job.assigned_dumpster_id;
  end if;
end;
$$;
revoke all on function public.reserve_job_assets(public.jobs, boolean) from public, anon, authenticated;

-- Make the placement ledger the one source of truth for where a container is.
--
-- 1. Completing a delivery never actually left the container "out". Both
--    completion RPCs call release_job_assets after the status update, and the
--    sync trigger from 202609230001 had just pointed current_job_id at that
--    same job, so release matched it and sent the can back to the Yard. Release
--    now asks the ledger: a container with an open placement rests at that
--    site, anything else goes back to the yard. This also keeps a cancelled or
--    dry-run pick-up from moving a can that never left the customer.
-- 2. A container out on a rental points current_job_id at its (completed)
--    delivery. reserve_job_assets read any non-null current_job_id as "busy",
--    which would refuse the pick-up for that very can. Only an en-route or
--    arrived job holds a container now.
-- 3. A pick-up booked against the wrong container (production, Sep 17: 20002
--    named, 20001 on site) closed nothing, so the real can stayed "on site"
--    forever. When the named container has nothing open, a pick-up closes the
--    single open placement for that customer at that address. A pick-up with
--    no container named does the same.
-- 4. Setting a dumpster to In Yard or In Shop by hand now ends its open rental.
--    Previously the asset row changed and the On Site panel did not.

create or replace function public.release_job_assets(previous_job public.jobs) returns void
language plpgsql security definer set search_path = '' as $$
declare
  placement public.container_placements;
begin
  if previous_job.assigned_truck_id is not null then
    update public.trucks
    set current_job_id = null,
        last_seen_at = now()
    where id = previous_job.assigned_truck_id and current_job_id = previous_job.id;
  end if;

  if previous_job.assigned_dumpster_id is not null then
    select * into placement from public.container_placements
      where dumpster_id = previous_job.assigned_dumpster_id and retrieved_at is null
      order by delivered_at desc limit 1;

    if placement.id is not null then
      update public.dumpsters
      set current_job_id = placement.delivered_job_id,
          current_customer_id = placement.customer_id,
          current_location = placement.address,
          status = case when status = 'in_shop' then status else 'out' end
      where id = previous_job.assigned_dumpster_id and current_job_id = previous_job.id;
    else
      update public.dumpsters
      set current_job_id = null,
          current_customer_id = null,
          current_location = 'Yard',
          status = case when status = 'in_shop' then status else 'in_yard' end
      where id = previous_job.assigned_dumpster_id and current_job_id = previous_job.id;
    end if;
  end if;
end;
$$;

create or replace function public.reserve_job_assets(next_job public.jobs) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if next_job.status not in ('en_route','arrived') then return; end if;
  perform public.assert_active_user(next_job.assigned_driver_id, 'driver');
  if next_job.assigned_driver_id is null then raise exception 'Assign a driver before starting the job'; end if;

  if next_job.assigned_truck_id is not null then
    perform 1 from public.trucks
      where id=next_job.assigned_truck_id and deleted_at is null and status='in_use'
        and (current_job_id is null or current_job_id=next_job.id) for update;
    if not found then raise exception 'Selected truck is active on another job or unavailable'; end if;
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

create or replace function public.sync_container_placement() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  container text := new.assigned_dumpster_id;
  open_at_site text[];
begin
  if new.status <> 'complete' or old.status = 'complete' then return new; end if;
  if new.deleted_at is not null then return new; end if;

  if new.service_type = 'Pick-Up' then
    if container is not null then
      update public.container_placements
        set retrieved_at = new.updated_at, retrieved_job_id = new.id
        where dumpster_id = container and retrieved_at is null;
      if found then return new; end if;
    end if;
    -- The named can was not out (or none was named). If exactly one can is
    -- standing at this customer's address, that is the one the driver brought
    -- back. With several, guessing would close the wrong rental, so leave them
    -- for dispatch to see on the On Site panel.
    select array_agg(id) into open_at_site from public.container_placements
      where retrieved_at is null
        and customer_id = new.customer_id
        and lower(trim(address)) = lower(trim(new.address));
    if coalesce(array_length(open_at_site, 1), 0) = 1 then
      update public.container_placements
        set retrieved_at = new.updated_at, retrieved_job_id = new.id
        where id = open_at_site[1];
    end if;
    return new;
  end if;

  if container is null then return new; end if;

  if new.service_type = 'Delivery' then
    -- Close anything still open for this container before opening the next
    -- span; an unclosed prior placement means a pick-up went unrecorded, and
    -- the partial unique index would otherwise reject the new row outright.
    update public.container_placements
      set retrieved_at = new.updated_at
      where dumpster_id = container and retrieved_at is null;
    insert into public.container_placements(
      customer_id, dumpster_id, address, delivered_job_id, delivered_at
    ) values (new.customer_id, container, new.address, new.id, new.updated_at);

  elsif new.service_type = 'Swap / Exchange' then
    -- The full can leaving the site is whatever is open at this address, which
    -- is not the container named on the job. Close it against this job first.
    update public.container_placements
      set retrieved_at = new.updated_at, retrieved_job_id = new.id
      where retrieved_at is null
        and customer_id = new.customer_id
        and address = new.address
        and dumpster_id <> container;
    -- The arriving can should not already be standing somewhere; if it is, an
    -- earlier pick-up went unrecorded and the open span would collide with the
    -- partial unique index below.
    update public.container_placements
      set retrieved_at = new.updated_at
      where dumpster_id = container and retrieved_at is null;
    insert into public.container_placements(
      customer_id, dumpster_id, address, delivered_job_id, delivered_at
    ) values (new.customer_id, container, new.address, new.id, new.updated_at);

  elsif new.service_type = 'Relocation' then
    -- The same can moves to a new address on the same rental, so the span
    -- continues and only the address changes.
    update public.container_placements
      set address = new.address
      where dumpster_id = container and retrieved_at is null;
  end if;

  return new;
end;
$$;

create or replace function public.sync_dumpster_operational_location() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  departing_container text;
begin
  if new.status <> 'complete' or old.status = 'complete' or new.deleted_at is not null then
    return new;
  end if;

  if new.service_type = 'Pick-Up' then
    -- Whatever the ledger says this job retrieved is back in the yard, which
    -- may not be the container named on the job (see sync_container_placement).
    -- The named one follows only if it is not still out on another rental.
    update public.dumpsters d set
      status = 'in_yard', current_customer_id = null,
      current_location = 'Yard', current_job_id = null
    where d.id in (
        select dumpster_id from public.container_placements where retrieved_job_id = new.id
      )
      or (d.id = new.assigned_dumpster_id and not exists (
        select 1 from public.container_placements p
        where p.dumpster_id = d.id and p.retrieved_at is null
      ));

  elsif new.service_type = 'Delivery' and new.assigned_dumpster_id is not null then
    update public.dumpsters set
      status = 'out', current_customer_id = new.customer_id,
      current_location = new.address, current_job_id = new.id
    where id = new.assigned_dumpster_id;

  elsif new.service_type = 'Swap / Exchange' and new.assigned_dumpster_id is not null then
    select dumpster_id into departing_container from public.container_placements
      where retrieved_job_id = new.id and dumpster_id <> new.assigned_dumpster_id
      order by retrieved_at desc nulls last limit 1;
    if departing_container is not null then
      update public.dumpsters set
        status = 'in_yard', current_customer_id = null,
        current_location = 'Yard', current_job_id = null
      where id = departing_container;
    end if;
    update public.dumpsters set
      status = 'out', current_customer_id = new.customer_id,
      current_location = new.address, current_job_id = new.id
    where id = new.assigned_dumpster_id;

  elsif new.service_type = 'Relocation' and new.assigned_dumpster_id is not null then
    update public.dumpsters set
      current_customer_id = new.customer_id,
      current_location = new.address, current_job_id = new.id
    where id = new.assigned_dumpster_id;
  end if;
  return new;
end;
$$;

-- Every system path that brings a can home closes its placement first, so an
-- open placement surviving a move off "out" means dispatch changed it by hand.
create function public.close_placement_on_manual_return() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if old.status <> 'out' or new.status = 'out' then return new; end if;

  update public.container_placements
    set retrieved_at = now()
    where dumpster_id = new.id and retrieved_at is null;

  if not exists (
    select 1 from public.jobs held
    where held.id = new.current_job_id and held.status in ('en_route','arrived')
  ) then
    new.current_job_id := null;
    new.current_customer_id := null;
  end if;
  return new;
end;
$$;

create trigger dumpsters_close_placement_on_manual_return
  before update of status on public.dumpsters
  for each row execute function public.close_placement_on_manual_return();

revoke all on function public.close_placement_on_manual_return() from public, anon, authenticated;

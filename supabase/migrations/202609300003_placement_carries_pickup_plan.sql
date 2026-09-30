-- A pickup date entered when the job is booked is saved on the job before any
-- rental exists: the placement is only opened when the delivery completes, and
-- set_job_pickup_plan updates placements that already exist. Opening the
-- rental now carries the job's expected pickup date and status with it.

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
      customer_id, dumpster_id, address, delivered_job_id, delivered_at,
      expected_pickup_at, pickup_status
    ) values (
      new.customer_id, container, new.address, new.id, new.updated_at,
      new.expected_pickup_at,
      case when new.expected_pickup_at is null then 'not_scheduled' else 'scheduled' end
    );

  elsif new.service_type = 'Swap / Exchange' then
    -- The full can leaving the site is whatever is open at this address, which
    -- is not the container named on the job. Close it against this job first.
    update public.container_placements
      set retrieved_at = new.updated_at, retrieved_job_id = new.id
      where retrieved_at is null
        and customer_id = new.customer_id
        and lower(trim(address)) = lower(trim(new.address))
        and dumpster_id <> container;
    -- The arriving can should not already be standing somewhere; if it is, an
    -- earlier pick-up went unrecorded and the open span would collide with the
    -- partial unique index below.
    update public.container_placements
      set retrieved_at = new.updated_at
      where dumpster_id = container and retrieved_at is null;
    insert into public.container_placements(
      customer_id, dumpster_id, address, delivered_job_id, delivered_at,
      expected_pickup_at, pickup_status
    ) values (
      new.customer_id, container, new.address, new.id, new.updated_at,
      new.expected_pickup_at,
      case when new.expected_pickup_at is null then 'not_scheduled' else 'scheduled' end
    );

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

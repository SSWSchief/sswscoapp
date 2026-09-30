-- "Correct Assignment" on a completed job changed jobs.assigned_dumpster_id and
-- nothing else, so the rental and both dumpsters kept the wrong container --
-- exactly the mismatch dispatch reaches for that screen to fix. A correction
-- now moves the placement with it:
--   * Delivery / Swap: the open rental this job started moves to the corrected
--     can, which goes out at the site; the wrongly named one comes home.
--   * Pick-Up: rentals this job closed for another can are reopened, and the
--     corrected can's open rental is closed against this job.
-- It also carries the expected pickup date to the open rental, as
-- set_job_pickup_plan does.
--
-- Separately, a swap now matches the departing can's address the way a
-- pick-up does (case and surrounding spaces ignored); an exact comparison left
-- "2283 duneville street" and "2283 Duneville Street" as two different sites.

create or replace function public.correct_completed_job(
  target_job_id text,
  corrected_dumpster_id text,
  correction_reason text,
  corrected_pickup_at timestamptz default null
) returns public.jobs
language plpgsql security definer set search_path = '' as $$
declare
  actor text := public.current_app_user_id();
  previous public.jobs;
  changed public.jobs;
  completed_at timestamptz;
  moved public.container_placements;
  reopened record;
begin
  if not public.has_permission('jobs') then raise exception 'Jobs permission required'; end if;
  if length(trim(coalesce(correction_reason,''))) < 3 then raise exception 'A correction reason is required'; end if;
  select * into previous from public.jobs where id = target_job_id and deleted_at is null for update;
  if previous.id is null then raise exception 'Job not found'; end if;
  if previous.status <> 'complete' then raise exception 'Only completed jobs can be corrected'; end if;
  if corrected_dumpster_id is null or not exists(select 1 from public.dumpsters where id=corrected_dumpster_id and deleted_at is null) then
    raise exception 'A valid dumpster is required';
  end if;

  if corrected_dumpster_id is distinct from previous.assigned_dumpster_id then
    select coalesce(
      (select occurred_at from public.job_events where job_id = target_job_id and event_type = 'completed'),
      previous.updated_at
    ) into completed_at;

    if previous.service_type in ('Delivery','Swap / Exchange') then
      if exists (
        select 1 from public.container_placements
        where dumpster_id = corrected_dumpster_id and retrieved_at is null
          and delivered_job_id is distinct from target_job_id
      ) then
        raise exception 'That dumpster is on site at another job. Complete its pick-up first.';
      end if;
      update public.container_placements set dumpster_id = corrected_dumpster_id
        where delivered_job_id = target_job_id and retrieved_at is null
        returning * into moved;
      if moved.id is not null then
        update public.dumpsters set
          status = case when status = 'in_shop' then status else 'in_yard' end,
          current_location = 'Yard', current_customer_id = null, current_job_id = null
        where id = previous.assigned_dumpster_id
          and not exists (select 1 from public.container_placements p
                          where p.dumpster_id = previous.assigned_dumpster_id and p.retrieved_at is null);
        update public.dumpsters set
          status = 'out', current_location = moved.address,
          current_customer_id = moved.customer_id, current_job_id = target_job_id
        where id = corrected_dumpster_id;
      end if;

    elsif previous.service_type = 'Pick-Up' then
      -- Put back what this job closed for another can, unless that can has
      -- since gone out again.
      for reopened in
        select p.id, p.dumpster_id, p.address, p.customer_id, p.delivered_job_id
        from public.container_placements p
        where p.retrieved_job_id = target_job_id and p.dumpster_id <> corrected_dumpster_id
          and not exists (select 1 from public.container_placements o
                          where o.dumpster_id = p.dumpster_id and o.retrieved_at is null)
      loop
        update public.container_placements
          set retrieved_at = null, retrieved_job_id = null,
              pickup_status = case when expected_pickup_at is null then 'needed' else 'scheduled' end
          where id = reopened.id;
        update public.dumpsters set
          status = 'out', current_location = reopened.address,
          current_customer_id = reopened.customer_id, current_job_id = reopened.delivered_job_id
        where id = reopened.dumpster_id and status <> 'in_shop';
      end loop;

      update public.container_placements
        set retrieved_at = completed_at, retrieved_job_id = target_job_id, pickup_status = 'retrieved'
        where dumpster_id = corrected_dumpster_id and retrieved_at is null;
      if found then
        -- Its rental is already closed, so the manual-return trigger has
        -- nothing left to end.
        update public.dumpsters set
          status = case when status = 'in_shop' then status else 'in_yard' end,
          current_location = 'Yard', current_customer_id = null, current_job_id = null
        where id = corrected_dumpster_id;
      end if;
    end if;
  end if;

  update public.jobs set assigned_dumpster_id=corrected_dumpster_id, expected_pickup_at=corrected_pickup_at, updated_at=now()
    where id=target_job_id returning * into changed;
  update public.container_placements
    set expected_pickup_at = corrected_pickup_at,
        pickup_status = case when corrected_pickup_at is null then 'needed' else 'scheduled' end
    where delivered_job_id = target_job_id and retrieved_at is null;

  insert into public.job_activities(job_id,actor_id,actor_name,activity_type,body,dispatch_notified)
    select target_job_id, actor, u.full_name, 'assigned',
      'Completed job corrected: '||trim(correction_reason), true
    from public.users u where u.id=actor;
  perform public.write_audit('jobs',target_job_id,'correct_completed_job',to_jsonb(previous),to_jsonb(changed),trim(correction_reason));
  return changed;
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
        and lower(trim(address)) = lower(trim(new.address))
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

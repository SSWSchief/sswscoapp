-- Record a pick-up that happened without a Pick-Up job in Overwatch.
--
-- A rental only closed when a Pick-Up job was completed, or when someone
-- edited the dumpster to In Yard (which stamped the edit time as the pick-up
-- time and said nothing about it on the On Site list). On 2026-10-19 Austin
-- reported 20001, 20002 and 40001 still "out" although all three were back in
-- the yard: none of them ever had a Pick-Up job.
--
-- record_pickup closes one open placement on the day the office says the can
-- came back and returns the dumpster to the yard. The day is clamped to the
-- span the rental actually covers, so a date before delivery or in the future
-- cannot be written. A pick-up job already under way owns the can, so the call
-- is refused while one is en route or arrived.
create function public.record_pickup(target_placement_id text, picked_up_on date)
returns public.container_placements
language plpgsql security definer set search_path = '' as $$
declare
  app_user_id text := public.current_app_user_id();
  placement public.container_placements;
  previous public.container_placements;
  today date := (now() at time zone 'America/Los_Angeles')::date;
  at_time timestamptz;
begin
  if app_user_id is null then raise exception 'Not authenticated'; end if;
  if not coalesce(public.has_permission('jobs'), false) then raise exception 'Jobs permission required'; end if;

  select * into placement from public.container_placements
  where id = target_placement_id for update;
  if placement.id is null then raise exception 'Rental not found'; end if;
  if placement.retrieved_at is not null then raise exception 'That dumpster has already been picked up'; end if;
  if picked_up_on is null or picked_up_on > today then raise exception 'Pick-up date cannot be in the future'; end if;
  if picked_up_on < (placement.delivered_at at time zone 'America/Los_Angeles')::date then
    raise exception 'Pick-up date is before the dumpster was delivered';
  end if;
  if exists (
    select 1 from public.jobs j
    where j.deleted_at is null and j.status in ('en_route','arrived')
      and (j.id = placement.pickup_job_id
        or (j.service_type = 'Pick-Up' and j.assigned_dumpster_id = placement.dumpster_id))
  ) then
    raise exception 'A pick-up job for this dumpster is under way; complete that job instead';
  end if;

  -- Today means now; an earlier day means midday that day, never before the
  -- delivery itself.
  at_time := case when picked_up_on = today then now()
    else (picked_up_on + time '12:00') at time zone 'America/Los_Angeles' end;
  at_time := greatest(at_time, placement.delivered_at);

  previous := placement;
  update public.container_placements
    set retrieved_at = at_time, pickup_status = 'retrieved'
    where id = placement.id
    returning * into placement;

  -- The rental is closed first, so the manual-return trigger has nothing left
  -- to close and only clears the dumpster's link to the finished delivery.
  update public.dumpsters set
    status = 'in_yard', current_location = 'Yard', current_customer_id = null
  where id = placement.dumpster_id and status = 'out';

  perform public.write_audit('container_placements', placement.id, 'record_pickup',
    to_jsonb(previous), to_jsonb(placement), 'Picked up ' || picked_up_on::text);
  return placement;
end;
$$;

revoke all on function public.record_pickup(text, date) from public, anon;
grant execute on function public.record_pickup(text, date) to authenticated;

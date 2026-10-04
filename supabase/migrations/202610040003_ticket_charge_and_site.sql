-- Drivers record what the landfill charged, and where they dumped, on the
-- scale ticket they already file for each haul (Austin, 2026-09-30: "It would
-- be nice if they were able to add in the tonnage of the container they
-- dumped and the cost to do so"). The columns arrived with the profitability
-- foundations; this lets the ticket write them, so a job's dump fee is the
-- actual charge rather than an estimate.
--
-- Same function, two more optional arguments. The old signature is dropped
-- rather than overloaded, so a call naming only the original arguments is
-- never ambiguous between the two.

drop function public.record_disposal_ticket(text, integer, text, text, integer, integer, timestamptz, text, text);

create function public.record_disposal_ticket(
  target_job_id text,
  net_lbs integer,
  ticket_no text default '',
  disposal_vendor_id text default null,
  gross_lbs integer default null,
  tare_lbs integer default null,
  weighed timestamptz default null,
  ticket_storage_path text default null,
  ticket_notes text default '',
  fee_cents bigint default null,
  site_id text default null
) returns public.disposal_tickets language plpgsql security definer set search_path = '' as $$
declare
  app_user_id text := public.current_app_user_id();
  actor text;
  saved public.disposal_tickets;
  summary text;
begin
  if app_user_id is null then raise exception 'Not authenticated'; end if;
  if not public.has_permission('jobs') and not exists (
    select 1 from public.jobs
    where id = target_job_id
      and assigned_driver_id = app_user_id
      and deleted_at is null
  ) then raise exception 'Job is not assigned to this user'; end if;
  if net_lbs is null or net_lbs < 0 then raise exception 'Net weight is required'; end if;
  if gross_lbs is not null and tare_lbs is not null and gross_lbs < tare_lbs then
    raise exception 'Gross weight cannot be less than tare weight';
  end if;
  if fee_cents is not null and fee_cents < 0 then raise exception 'The landfill charge cannot be negative'; end if;
  if site_id is not null and not exists (select 1 from public.disposal_sites where id = site_id) then
    raise exception 'Unknown disposal site';
  end if;

  insert into public.disposal_tickets(
    job_id, ticket_number, vendor_id, gross_weight_lbs, tare_weight_lbs,
    net_weight_lbs, weighed_at, storage_path, notes, recorded_by_id,
    disposal_fee_cents, disposal_site_id
  ) values (
    target_job_id, coalesce(trim(ticket_no), ''), disposal_vendor_id, gross_lbs, tare_lbs,
    net_lbs, coalesce(weighed, now()), ticket_storage_path, coalesce(ticket_notes, ''), app_user_id,
    fee_cents, site_id
  )
  on conflict (job_id) do update set
    ticket_number = excluded.ticket_number,
    vendor_id = excluded.vendor_id,
    gross_weight_lbs = excluded.gross_weight_lbs,
    tare_weight_lbs = excluded.tare_weight_lbs,
    net_weight_lbs = excluded.net_weight_lbs,
    weighed_at = excluded.weighed_at,
    storage_path = coalesce(excluded.storage_path, public.disposal_tickets.storage_path),
    notes = excluded.notes,
    recorded_by_id = excluded.recorded_by_id,
    disposal_fee_cents = excluded.disposal_fee_cents,
    disposal_site_id = excluded.disposal_site_id
  returning * into saved;

  summary := 'Disposal ticket recorded: ' || round(net_lbs / 2000.0, 2)::text || ' tons';
  if fee_cents is not null then
    summary := summary || ', $' || to_char(fee_cents / 100.0, 'FM999999990.00');
  end if;
  if site_id is not null then
    summary := summary || ' at ' || (select name from public.disposal_sites where id = site_id);
  end if;

  select full_name into actor from public.users where id = app_user_id;
  insert into public.job_activities(job_id, actor_id, actor_name, activity_type, body, dispatch_notified)
    values (target_job_id, app_user_id, actor, 'note', summary, true);
  return saved;
end;
$$;

revoke all on function public.record_disposal_ticket(text, integer, text, text, integer, integer, timestamptz, text, text, bigint, text) from public, anon;
grant execute on function public.record_disposal_ticket(text, integer, text, text, integer, integer, timestamptz, text, text, bigint, text) to authenticated, service_role;

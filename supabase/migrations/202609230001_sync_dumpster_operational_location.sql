-- Keep the asset roster aligned with the job-completion placement ledger.
-- Previously, container_placements correctly recorded a completed delivery or
-- pickup while dumpsters.current_location continued to show its old value.

create function public.sync_dumpster_operational_location() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  departing_container text;
begin
  if new.status <> 'complete' or old.status = 'complete' or new.deleted_at is not null then
    return new;
  end if;

  if new.service_type = 'Delivery' and new.assigned_dumpster_id is not null then
    update public.dumpsters set
      status = 'out', current_customer_id = new.customer_id,
      current_location = new.address, current_job_id = new.id
    where id = new.assigned_dumpster_id;

  elsif new.service_type = 'Pick-Up' and new.assigned_dumpster_id is not null then
    update public.dumpsters set
      status = 'in_yard', current_customer_id = null,
      current_location = 'Yard', current_job_id = null
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

create trigger jobs_sync_dumpster_operational_location
  after update of status on public.jobs
  for each row execute function public.sync_dumpster_operational_location();

revoke all on function public.sync_dumpster_operational_location() from public, anon, authenticated;

-- Reconcile existing assets from the authoritative open-placement ledger.
update public.dumpsters d set
  status = 'out',
  current_customer_id = placement.customer_id,
  current_location = placement.address,
  current_job_id = placement.delivered_job_id
from public.container_placements placement
where placement.dumpster_id = d.id and placement.retrieved_at is null;

-- Additive indexes for the application's foreign-key, filter, and chronological access paths.
create index if not exists jobs_customer_schedule_idx on public.jobs(customer_id,scheduled_for desc) where deleted_at is null;
create index if not exists jobs_customer_status_idx on public.jobs(customer_id,status) where deleted_at is null;
create index if not exists jobs_truck_active_idx on public.jobs(assigned_truck_id,status) where assigned_truck_id is not null and deleted_at is null;
create index if not exists jobs_dumpster_active_idx on public.jobs(assigned_dumpster_id,status) where assigned_dumpster_id is not null and deleted_at is null;
create index if not exists job_events_job_idx on public.job_events(job_id);
create index if not exists job_notes_job_created_idx on public.job_notes(job_id,created_at desc);
create index if not exists job_photos_job_created_idx on public.job_photos(job_id,created_at desc);
create index if not exists notifications_job_idx on public.notifications(related_job_id) where related_job_id is not null;
create index if not exists time_requests_user_status_idx on public.time_requests(user_id,status,created_at desc);
create index if not exists absence_user_date_idx on public.absence_events(user_id,event_date);
create index if not exists invoices_customer_due_idx on public.invoices(customer_id,due_date);
create index if not exists invoices_job_idx on public.invoices(job_id) where job_id is not null;
create index if not exists message_members_user_idx on public.message_channel_members(user_id,channel_id);
create index if not exists messages_channel_created_idx on public.messages(channel_id,created_at desc);
create index if not exists message_reads_user_read_idx on public.message_reads(user_id,read_at desc);
create index if not exists pretrip_driver_submitted_idx on public.pretrip_submissions(driver_id,submitted_at desc);
create index if not exists pretrip_truck_submitted_idx on public.pretrip_submissions(truck_id,submitted_at desc);
create index if not exists sop_ack_user_idx on public.sop_acknowledgements(user_id,acknowledged_at desc);
create index if not exists trucks_driver_idx on public.trucks(assigned_driver_id) where assigned_driver_id is not null;
create index if not exists trucks_current_job_idx on public.trucks(current_job_id) where current_job_id is not null;
create index if not exists dumpsters_current_job_idx on public.dumpsters(current_job_id) where current_job_id is not null;
create index if not exists dumpsters_customer_idx on public.dumpsters(current_customer_id) where current_customer_id is not null;

create table if not exists public.api_rate_limits(
  subject text not null,
  bucket text not null,
  window_started_at timestamptz not null default now(),
  attempts integer not null default 1 check(attempts > 0),
  primary key(subject,bucket)
);
alter table public.api_rate_limits enable row level security;

create or replace function public.consume_api_rate_limit(rate_bucket text,maximum_attempts integer,window_seconds integer)
returns boolean language plpgsql volatile security definer set search_path='' as $$
declare actor text:=coalesce(public.current_app_user_id(),auth.uid()::text); current_attempts integer;
begin
  if actor is null then return false; end if;
  if rate_bucket !~ '^[a-z0-9:_-]{1,80}$' or maximum_attempts not between 1 and 1000 or window_seconds not between 1 and 86400 then
    raise exception 'Invalid rate-limit configuration';
  end if;
  insert into public.api_rate_limits(subject,bucket,window_started_at,attempts)
  values(actor,rate_bucket,clock_timestamp(),1)
  on conflict(subject,bucket) do update set
    window_started_at=case when public.api_rate_limits.window_started_at < clock_timestamp()-make_interval(secs=>window_seconds) then clock_timestamp() else public.api_rate_limits.window_started_at end,
    attempts=case when public.api_rate_limits.window_started_at < clock_timestamp()-make_interval(secs=>window_seconds) then 1 else public.api_rate_limits.attempts+1 end
  returning attempts into current_attempts;
  return current_attempts<=maximum_attempts;
end;
$$;
revoke all on function public.consume_api_rate_limit(text,integer,integer) from public,anon;
grant execute on function public.consume_api_rate_limit(text,integer,integer) to authenticated,service_role;

create or replace function public.customer_active_job_counts()
returns table(customer_id uuid,active_jobs bigint)
language sql stable security invoker set search_path='' as $$
  select jobs.customer_id,count(*)
  from public.jobs
  where jobs.deleted_at is null and jobs.status not in ('complete','cancelled')
  group by jobs.customer_id
$$;
revoke all on function public.customer_active_job_counts() from public,anon;
grant execute on function public.customer_active_job_counts() to authenticated,service_role;

create or replace function public.run_scheduled_maintenance_safe()
returns jsonb language plpgsql security definer set search_path='' as $$
begin
  if auth.role()<>'service_role' then raise exception 'Service role required'; end if;
  if not pg_try_advisory_xact_lock(hashtext('sswsco:scheduled-maintenance')) then
    return jsonb_build_object('status','skipped','reason','already_running');
  end if;
  return jsonb_build_object('status','complete','result',public.run_scheduled_maintenance());
end;
$$;
revoke all on function public.run_scheduled_maintenance_safe() from public,anon,authenticated;
grant execute on function public.run_scheduled_maintenance_safe() to service_role;

comment on table public.api_rate_limits is 'Private fixed-window counters for authenticated application endpoints.';
comment on function public.admin_mfa_verified() is
  'Legacy policy predicate retained for compatibility. Under the approved password-only administrator policy it validates an active administrator profile; MFA is intentionally disabled and documented as an accepted residual risk.';

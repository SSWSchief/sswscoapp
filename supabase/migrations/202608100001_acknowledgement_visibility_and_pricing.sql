-- Client requests, August 2026.
--
-- Acknowledgement and read state were already captured correctly; only the
-- recipient could see them. `notifications_read`, `message_reads_own`, and
-- `sop_ack_own` all scope SELECT to the owning user, so dispatch had no way to
-- tell whether a driver had acknowledged an assignment or read an announcement.
--
-- Rather than widen those policies (which would expose every notification body
-- to all staff), visibility is delivered through narrow security-definer
-- functions that return only acknowledgement state.
--
-- Also adds the dumpster price list, so dispatch can maintain rates and invoice
-- creation can prefill from them.

-- ---------------------------------------------------------------------------
-- Acknowledgement visibility
-- ---------------------------------------------------------------------------

-- Who has acknowledged an assignment for this job, and when.
create function public.job_acknowledgement_status(target_job_id text)
returns table(user_id text, full_name text, acknowledged_at timestamptz)
language sql stable security definer set search_path='' as $$
  select u.id, u.full_name, n.acknowledged_at
  from public.notifications n
  join public.users u on u.id = n.recipient_user_id
  where n.related_job_id = target_job_id
    and n.category = 'job_assignment'
    and public.is_staff()
  order by n.created_at desc
$$;
revoke all on function public.job_acknowledgement_status(text) from public, anon;
grant execute on function public.job_acknowledgement_status(text) to authenticated, service_role;

-- Who has read a message. Restricted to members of that message's channel, so
-- read state never leaks outside the conversation it belongs to.
create function public.message_read_receipts(target_message_id text)
returns table(user_id text, full_name text, read_at timestamptz)
language sql stable security definer set search_path='' as $$
  select u.id, u.full_name, r.read_at
  from public.message_reads r
  join public.users u on u.id = r.user_id
  join public.messages m on m.id = r.message_id
  where r.message_id = target_message_id
    and exists(
      select 1 from public.message_channel_members mem
      where mem.channel_id = m.channel_id
        and mem.user_id = public.current_app_user_id()
    )
  order by r.read_at
$$;
revoke all on function public.message_read_receipts(text) from public, anon;
grant execute on function public.message_read_receipts(text) to authenticated, service_role;

-- Acknowledgement coverage for a published SOP: every active driver, with the
-- acknowledgement timestamp when present. Staff need the gaps, not just the
-- confirmations, so outstanding people come back as nulls rather than absent.
create function public.sop_acknowledgement_coverage(target_sop_id text)
returns table(user_id text, full_name text, acknowledged_at timestamptz)
language sql stable security definer set search_path='' as $$
  select u.id, u.full_name, a.acknowledged_at
  from public.users u
  left join public.sop_acknowledgements a
    on a.user_id = u.id and a.sop_id = target_sop_id
  where u.status = 'active'
    and u.deleted_at is null
    and u.access_role = 'driver'
    and public.is_staff()
  order by a.acknowledged_at nulls first, u.full_name
$$;
revoke all on function public.sop_acknowledgement_coverage(text) from public, anon;
grant execute on function public.sop_acknowledgement_coverage(text) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Dumpster price list
-- ---------------------------------------------------------------------------

create table public.price_list (
  id text primary key default gen_random_uuid()::text,
  service_type text not null check (service_type in ('Delivery', 'Pick-Up', 'Dump & Return', 'Swap / Exchange', 'Relocation', 'Dry Run', 'Service Call')),
  dumpster_size text not null check (dumpster_size in ('10 Yard', '20 Yard', '30 Yard', '40 Yard')),
  price_cents bigint not null check (price_cents >= 0),
  notes text not null default '',
  updated_by_id text references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (service_type, dumpster_size)
);

comment on table public.price_list is
  'Reference rates by service and container size. Invoices copy the amount at creation; they never read through to this table, so changing a rate never alters an issued invoice.';

create trigger price_list_set_updated_at
  before update on public.price_list
  for each row execute function public.set_updated_at();
create trigger price_list_audit
  after insert or update or delete on public.price_list
  for each row execute function public.audit_row_change();

alter table public.price_list enable row level security;

-- Every staff member prices work, so reads are staff-wide; writes are staff too
-- (the client asked dispatch to maintain this), and every change is audited.
create policy price_list_staff_read on public.price_list
  for select to authenticated using (public.is_staff());
create policy price_list_staff_write on public.price_list
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

create index price_list_lookup_idx on public.price_list (service_type, dumpster_size);

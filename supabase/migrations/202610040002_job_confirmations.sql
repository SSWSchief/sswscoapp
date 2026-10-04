-- Customer job confirmations (Austin's texts of 2026-10-01, Fred's idea).
--
-- A customer called on a delivery day to check the job was booked, because
-- nothing had told them it was. Once a job is created Overwatch emails the
-- customer its date, time, address and size, with Confirm and Request a
-- change buttons, and dispatch sees the answer on the job.
--
-- One row per email sent. Rescheduling sends a new one and supersedes the
-- last, so an old link can never confirm a time that no longer stands. Only
-- a hash of each link's token is kept: whoever reads this table cannot answer
-- for the customer. Rows are written by the server alone (service role);
-- staff with jobs access can read them, drivers cannot.

create table public.job_confirmations (
  id text primary key default gen_random_uuid()::text,
  job_id text not null references public.jobs(id) on delete cascade,
  token_hash text not null unique,
  recipient_email text not null
    check (recipient_email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  -- The time the customer is being asked to confirm, as sent.
  scheduled_for timestamptz not null,
  sent_at timestamptz,
  send_error text,
  provider_message_id text,
  response text check (response in ('confirmed', 'change_requested')),
  response_note text not null default '' check (length(response_note) <= 1000),
  responded_at timestamptz,
  superseded_at timestamptz,
  requested_by_id text references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  check ((response is null) = (responded_at is null))
);

create unique index job_confirmations_one_current
  on public.job_confirmations(job_id) where superseded_at is null;

comment on table public.job_confirmations is
  'Confirmation emails sent to customers for their jobs, and how each customer answered.';

create trigger job_confirmations_audit
  after insert or update or delete on public.job_confirmations
  for each row execute function public.audit_row_change();

alter table public.job_confirmations enable row level security;
create policy job_confirmations_read on public.job_confirmations
  for select to authenticated using (public.has_permission('jobs'));
grant select on public.job_confirmations to authenticated;
revoke all on public.job_confirmations from anon;
grant all on public.job_confirmations to service_role;

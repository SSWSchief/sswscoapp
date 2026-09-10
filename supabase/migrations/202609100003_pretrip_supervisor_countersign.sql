-- The supervisor half of the pre-trip form.
--
-- The paper report carries two signature lines. The driver's was captured when
-- the roll-off form was seeded; this adds the counter-signature, which is the
-- part that closes a failed inspection out.
--
-- It goes through a function rather than a policy on purpose. `pretrip_submissions`
-- deliberately has no update policy — a submitted inspection is a record, not a
-- document — and opening one would let a driver rewrite their own answers after
-- the fact. This grants exactly one narrow write instead.

alter table public.pretrip_submissions
  add column if not exists supervisor_signed_at timestamptz;

comment on column public.pretrip_submissions.supervisor_signed_at is
  'When a supervisor counter-signed. Null while the inspection is still awaiting review.';

create or replace function public.countersign_pretrip_submission(
  submission_id text,
  signature text
) returns public.pretrip_submissions
language plpgsql security definer set search_path='' as $$
declare
  updated public.pretrip_submissions;
  actor text := public.current_app_user_id();
begin
  if actor is null then raise exception 'Sign in required'; end if;
  if public.current_access_role() not in ('dispatcher','admin') then
    raise exception 'Supervisor access required';
  end if;
  if length(trim(coalesce(signature,''))) < 2 then
    raise exception 'Supervisor signature is required';
  end if;
  if length(trim(signature)) > 120 then
    raise exception 'Supervisor signature is too long';
  end if;

  select * into updated from public.pretrip_submissions
    where id=submission_id for update;
  if updated.id is null then raise exception 'Inspection not found'; end if;

  -- The counter-signature is a second pair of eyes. A driver signing off their
  -- own failed inspection is the exact thing it exists to prevent.
  if updated.driver_id = actor then
    raise exception 'An inspection cannot be counter-signed by the driver who submitted it';
  end if;
  -- Countersigning is once and final, so a later reviewer cannot quietly
  -- replace the name attached to an accepted inspection.
  if length(trim(coalesce(updated.supervisor_signature,''))) > 0 then
    raise exception 'This inspection is already counter-signed';
  end if;

  update public.pretrip_submissions
    set supervisor_signature=trim(signature), supervisor_signed_at=now()
    where id=submission_id
    returning * into updated;
  return updated;
end;
$$;

revoke all on function public.countersign_pretrip_submission(text,text) from public,anon;
grant execute on function public.countersign_pretrip_submission(text,text) to authenticated;

-- Keep the database's dispatcher defaults in step with the application's. The
-- counter-sign function gates on access role rather than this key, so nothing
-- server-side depends on it — but a permission that exists in one list and not
-- the other is how the two drift apart.
--
-- Reproduced from 202608160002_vendors, which is the definition currently in
-- force, with 'pretrip_review' as the only change. Rebuilding it from the
-- original in 202608060007 would have quietly dropped both the 'vendors'
-- permission and the administrator MFA gate added since.
create or replace function public.has_permission(permission_key text)
returns boolean language sql stable security definer set search_path = '' as $$
  with profile as(select access_role,permission_overrides from public.users where auth_user_id=auth.uid() and status='active' and deleted_at is null limit 1),
  defaults as(select access_role,case when access_role='dispatcher' then permission_key=any(array['dashboard','jobs','customers','trucks','dumpsters','vendors','time_clock','absence','messages','map','reports','pretrip_review']) when access_role='driver' then permission_key=any(array['driver_jobs','time_clock','messages','pre_trip','sops','profile']) else false end allowed,permission_overrides from profile)
  select case when access_role='admin' then public.admin_mfa_verified() and coalesce((permission_overrides->>permission_key)::boolean,true) else coalesce((permission_overrides->>permission_key)::boolean,allowed,false) end from defaults
$$;
revoke all on function public.has_permission(text) from public,anon;
grant execute on function public.has_permission(text) to authenticated;

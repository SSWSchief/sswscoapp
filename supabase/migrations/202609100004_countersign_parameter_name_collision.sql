-- Fix an ambiguous reference in countersign_pretrip_submission.
--
-- The parameter was named `signature`, and `pretrip_submissions.signature` is
-- the driver's own signature column. Inside the UPDATE, `trim(signature)` could
-- mean either, so PL/pgSQL refused it at runtime with 42702 — every attempt to
-- counter-sign would have raised "column reference is ambiguous" rather than
-- writing anything.
--
-- The local rehearsal could not catch this: it applies the chain and runs the
-- pgTAP suites, and neither one ever calls this function, so the ambiguity was
-- never resolved. `supabase db lint` reads function bodies statically and found
-- it on the first staging run. A lint step now runs in the local rehearsal too.
--
-- The parameter is renamed rather than qualified, because a caller reading
-- `signature` against a table that already has a `signature` column has the
-- same question the parser did. CREATE OR REPLACE cannot rename an input
-- parameter, so this drops and recreates.

drop function if exists public.countersign_pretrip_submission(text,text);

create function public.countersign_pretrip_submission(
  submission_id text,
  supervisor_name text
) returns public.pretrip_submissions
language plpgsql security definer set search_path='' as $$
declare
  updated public.pretrip_submissions;
  actor text := public.current_app_user_id();
  cleaned text := trim(coalesce(supervisor_name,''));
begin
  if actor is null then raise exception 'Sign in required'; end if;
  if public.current_access_role() not in ('dispatcher','admin') then
    raise exception 'Supervisor access required';
  end if;
  if length(cleaned) < 2 then
    raise exception 'Supervisor signature is required';
  end if;
  if length(cleaned) > 120 then
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
    set supervisor_signature=cleaned, supervisor_signed_at=now()
    where id=submission_id
    returning * into updated;
  return updated;
end;
$$;

revoke all on function public.countersign_pretrip_submission(text,text) from public,anon;
grant execute on function public.countersign_pretrip_submission(text,text) to authenticated;

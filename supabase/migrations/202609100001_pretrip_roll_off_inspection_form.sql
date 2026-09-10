-- Silver State's own CDL roll-off pre-trip inspection report.
--
-- The schema shipped with a six-item placeholder ("Daily Truck Pre-Trip") that
-- stood in for this document. Drivers were signing a generic checklist in place
-- of the DOT form the company actually runs, so this seeds the real one and
-- retires the placeholder.
--
-- Both `items` and `results` are unconstrained jsonb, so the section grouping
-- and the third N/A answer need no shape change. What does need columns is the
-- part of the paper form below the checklist: the safe-to-operate call, the
-- defect and repair notes, and the supervisor counter-signature. They are added
-- nullable, so every submission already recorded stays valid.

alter table public.pretrip_submissions
  add column if not exists safe_to_operate boolean,
  add column if not exists defects_found text not null default '',
  add column if not exists repairs_required text not null default '',
  add column if not exists supervisor_signature text not null default '',
  -- Copied from the truck at submission time rather than referenced, so an
  -- inspection record produced for an audit still reads correctly after the
  -- vehicle record is edited or the truck leaves the fleet.
  add column if not exists vin_snapshot text not null default '',
  add column if not exists route_note text not null default '';

alter table public.pretrip_submissions
  drop constraint if exists pretrip_submissions_defects_check;
alter table public.pretrip_submissions
  add constraint pretrip_submissions_defects_check
  check (length(defects_found) <= 2000 and length(repairs_required) <= 2000
     and length(supervisor_signature) <= 120 and length(vin_snapshot) <= 32
     and length(route_note) <= 200);

comment on column public.pretrip_submissions.safe_to_operate is
  'Driver''s explicit answer to "Vehicle Safe To Operate?". Null on submissions recorded before the form carried the question.';

-- Retire the placeholder before publishing the real form. Unlike sop_documents,
-- pretrip_templates has no trigger that retires prior versions on publish, so
-- leaving this out would present drivers two published checklists.
update public.pretrip_templates set is_published=false where is_published;

insert into public.pretrip_templates(title,version,is_published,items)
select 'CDL Roll-Off Truck Pre-Trip Inspection',
  coalesce((select max(version) from public.pretrip_templates
    where title='CDL Roll-Off Truck Pre-Trip Inspection'),0)+1,
  true,
  '[{"id":"doc-registration","section":"Documentation & Compliance","label":"Registration"},{"id":"doc-insurance-card","section":"Documentation & Compliance","label":"Insurance Card"},{"id":"doc-dot-inspection","section":"Documentation & Compliance","label":"DOT Inspection"},{"id":"doc-eld","section":"Documentation & Compliance","label":"ELD"},{"id":"doc-accident-packet","section":"Documentation & Compliance","label":"Accident Packet"},{"id":"engine-engine-oil","section":"Engine Compartment","label":"Engine Oil"},{"id":"engine-coolant","section":"Engine Compartment","label":"Coolant"},{"id":"engine-hydraulic-fluid","section":"Engine Compartment","label":"Hydraulic Fluid"},{"id":"engine-belts","section":"Engine Compartment","label":"Belts"},{"id":"engine-hoses","section":"Engine Compartment","label":"Hoses"},{"id":"engine-leaks","section":"Engine Compartment","label":"Leaks"},{"id":"lights-headlights","section":"Lights & Electrical","label":"Headlights"},{"id":"lights-turn-signals","section":"Lights & Electrical","label":"Turn Signals"},{"id":"lights-marker-lights","section":"Lights & Electrical","label":"Marker Lights"},{"id":"lights-brake-lights","section":"Lights & Electrical","label":"Brake Lights"},{"id":"lights-beacon-strobe","section":"Lights & Electrical","label":"Beacon/Strobe"},{"id":"tires-steer-tires","section":"Tires & Wheels","label":"Steer Tires"},{"id":"tires-drive-tires","section":"Tires & Wheels","label":"Drive Tires"},{"id":"tires-inflation","section":"Tires & Wheels","label":"Inflation"},{"id":"tires-lug-nuts","section":"Tires & Wheels","label":"Lug Nuts"},{"id":"tires-rims","section":"Tires & Wheels","label":"Rims"},{"id":"tires-hub-seals","section":"Tires & Wheels","label":"Hub Seals"},{"id":"air-air-build-up","section":"Air Brake System","label":"Air Build-Up"},{"id":"air-static-leak-test","section":"Air Brake System","label":"Static Leak Test"},{"id":"air-applied-leak-test","section":"Air Brake System","label":"Applied Leak Test"},{"id":"air-low-air-warning","section":"Air Brake System","label":"Low Air Warning"},{"id":"air-spring-brakes","section":"Air Brake System","label":"Spring Brakes"},{"id":"rolloff-pto-engagement","section":"SSWS Roll-Off System","label":"PTO Engagement"},{"id":"rolloff-pto-disengagement","section":"SSWS Roll-Off System","label":"PTO Disengagement"},{"id":"rolloff-hoist-cylinder","section":"SSWS Roll-Off System","label":"Hoist Cylinder"},{"id":"rolloff-hydraulic-hoses","section":"SSWS Roll-Off System","label":"Hydraulic Hoses"},{"id":"rolloff-main-cable","section":"SSWS Roll-Off System","label":"Main Cable"},{"id":"rolloff-hook-assembly","section":"SSWS Roll-Off System","label":"Hook Assembly"},{"id":"rolloff-rails","section":"SSWS Roll-Off System","label":"Rails"},{"id":"rolloff-rollers","section":"SSWS Roll-Off System","label":"Rollers"},{"id":"dumpster-tarp-system","section":"Dumpster Safety Equipment","label":"Tarp System"},{"id":"dumpster-safety-chains","section":"Dumpster Safety Equipment","label":"Safety Chains"},{"id":"dumpster-backup-alarm","section":"Dumpster Safety Equipment","label":"Backup Alarm"},{"id":"dumpster-backup-camera","section":"Dumpster Safety Equipment","label":"Backup Camera"},{"id":"dumpster-work-lights","section":"Dumpster Safety Equipment","label":"Work Lights"},{"id":"cab-horn","section":"Cab & Safety Equipment","label":"Horn"},{"id":"cab-seat-belt","section":"Cab & Safety Equipment","label":"Seat Belt"},{"id":"cab-fire-extinguisher","section":"Cab & Safety Equipment","label":"Fire Extinguisher"},{"id":"cab-reflective-triangles","section":"Cab & Safety Equipment","label":"Reflective Triangles"},{"id":"cab-wheel-chocks","section":"Cab & Safety Equipment","label":"Wheel Chocks"},{"id":"function-raise-hoist","section":"Operational Function Test","label":"Raise Hoist"},{"id":"function-lower-hoist","section":"Operational Function Test","label":"Lower Hoist"},{"id":"function-load-test","section":"Operational Function Test","label":"Load Test"},{"id":"function-unload-test","section":"Operational Function Test","label":"Unload Test"},{"id":"function-tarp-function-test","section":"Operational Function Test","label":"Tarp Function Test"}]'::jsonb
where not exists(
  select 1 from public.pretrip_templates
  where title='CDL Roll-Off Truck Pre-Trip Inspection' and items='[{"id":"doc-registration","section":"Documentation & Compliance","label":"Registration"},{"id":"doc-insurance-card","section":"Documentation & Compliance","label":"Insurance Card"},{"id":"doc-dot-inspection","section":"Documentation & Compliance","label":"DOT Inspection"},{"id":"doc-eld","section":"Documentation & Compliance","label":"ELD"},{"id":"doc-accident-packet","section":"Documentation & Compliance","label":"Accident Packet"},{"id":"engine-engine-oil","section":"Engine Compartment","label":"Engine Oil"},{"id":"engine-coolant","section":"Engine Compartment","label":"Coolant"},{"id":"engine-hydraulic-fluid","section":"Engine Compartment","label":"Hydraulic Fluid"},{"id":"engine-belts","section":"Engine Compartment","label":"Belts"},{"id":"engine-hoses","section":"Engine Compartment","label":"Hoses"},{"id":"engine-leaks","section":"Engine Compartment","label":"Leaks"},{"id":"lights-headlights","section":"Lights & Electrical","label":"Headlights"},{"id":"lights-turn-signals","section":"Lights & Electrical","label":"Turn Signals"},{"id":"lights-marker-lights","section":"Lights & Electrical","label":"Marker Lights"},{"id":"lights-brake-lights","section":"Lights & Electrical","label":"Brake Lights"},{"id":"lights-beacon-strobe","section":"Lights & Electrical","label":"Beacon/Strobe"},{"id":"tires-steer-tires","section":"Tires & Wheels","label":"Steer Tires"},{"id":"tires-drive-tires","section":"Tires & Wheels","label":"Drive Tires"},{"id":"tires-inflation","section":"Tires & Wheels","label":"Inflation"},{"id":"tires-lug-nuts","section":"Tires & Wheels","label":"Lug Nuts"},{"id":"tires-rims","section":"Tires & Wheels","label":"Rims"},{"id":"tires-hub-seals","section":"Tires & Wheels","label":"Hub Seals"},{"id":"air-air-build-up","section":"Air Brake System","label":"Air Build-Up"},{"id":"air-static-leak-test","section":"Air Brake System","label":"Static Leak Test"},{"id":"air-applied-leak-test","section":"Air Brake System","label":"Applied Leak Test"},{"id":"air-low-air-warning","section":"Air Brake System","label":"Low Air Warning"},{"id":"air-spring-brakes","section":"Air Brake System","label":"Spring Brakes"},{"id":"rolloff-pto-engagement","section":"SSWS Roll-Off System","label":"PTO Engagement"},{"id":"rolloff-pto-disengagement","section":"SSWS Roll-Off System","label":"PTO Disengagement"},{"id":"rolloff-hoist-cylinder","section":"SSWS Roll-Off System","label":"Hoist Cylinder"},{"id":"rolloff-hydraulic-hoses","section":"SSWS Roll-Off System","label":"Hydraulic Hoses"},{"id":"rolloff-main-cable","section":"SSWS Roll-Off System","label":"Main Cable"},{"id":"rolloff-hook-assembly","section":"SSWS Roll-Off System","label":"Hook Assembly"},{"id":"rolloff-rails","section":"SSWS Roll-Off System","label":"Rails"},{"id":"rolloff-rollers","section":"SSWS Roll-Off System","label":"Rollers"},{"id":"dumpster-tarp-system","section":"Dumpster Safety Equipment","label":"Tarp System"},{"id":"dumpster-safety-chains","section":"Dumpster Safety Equipment","label":"Safety Chains"},{"id":"dumpster-backup-alarm","section":"Dumpster Safety Equipment","label":"Backup Alarm"},{"id":"dumpster-backup-camera","section":"Dumpster Safety Equipment","label":"Backup Camera"},{"id":"dumpster-work-lights","section":"Dumpster Safety Equipment","label":"Work Lights"},{"id":"cab-horn","section":"Cab & Safety Equipment","label":"Horn"},{"id":"cab-seat-belt","section":"Cab & Safety Equipment","label":"Seat Belt"},{"id":"cab-fire-extinguisher","section":"Cab & Safety Equipment","label":"Fire Extinguisher"},{"id":"cab-reflective-triangles","section":"Cab & Safety Equipment","label":"Reflective Triangles"},{"id":"cab-wheel-chocks","section":"Cab & Safety Equipment","label":"Wheel Chocks"},{"id":"function-raise-hoist","section":"Operational Function Test","label":"Raise Hoist"},{"id":"function-lower-hoist","section":"Operational Function Test","label":"Lower Hoist"},{"id":"function-load-test","section":"Operational Function Test","label":"Load Test"},{"id":"function-unload-test","section":"Operational Function Test","label":"Unload Test"},{"id":"function-tarp-function-test","section":"Operational Function Test","label":"Tarp Function Test"}]'::jsonb);

-- Widen the publish path so an administrator re-publishing from Settings cannot
-- silently flatten the sections back out. Dropped and recreated rather than
-- overloaded: a two-argument call would be ambiguous against a default.
drop function if exists public.publish_pretrip_template(text,text[]);

create function public.publish_pretrip_template(
  template_title text,
  item_labels text[],
  item_sections text[] default null
)
returns public.pretrip_templates language plpgsql security definer set search_path='' as $$
declare
  actor text:=public.current_app_user_id();
  next_version integer; created public.pretrip_templates; cleaned text[]; sections text[];
begin
  if not public.admin_mfa_verified() then raise exception 'Administrator MFA required'; end if;
  if length(trim(coalesce(template_title,''))) < 2 then raise exception 'Checklist title is required'; end if;
  select array_agg(trim(label) order by ordinality) into cleaned
    from unnest(coalesce(item_labels,array[]::text[])) with ordinality as items(label,ordinality)
    where length(trim(label)) > 0;
  if coalesce(array_length(cleaned,1),0) = 0 then raise exception 'At least one checklist item is required'; end if;
  if array_length(cleaned,1) > 80 then raise exception 'Checklist cannot exceed 80 items'; end if;
  if item_sections is not null and array_length(item_sections,1) <> array_length(item_labels,1) then
    raise exception 'Each checklist item needs a matching section';
  end if;
  sections := item_sections;
  lock table public.pretrip_templates in exclusive mode;
  select coalesce(max(version),0)+1 into next_version
    from public.pretrip_templates where title=trim(template_title);
  update public.pretrip_templates set is_published=false where is_published;
  insert into public.pretrip_templates(title,version,is_published,items,created_by_id)
  values(trim(template_title),next_version,true,
    (select jsonb_agg(
       case when sections is null then jsonb_build_object('id','item-'||ordinality,'label',label)
            else jsonb_build_object('id','item-'||ordinality,'label',label,
                                    'section',coalesce(trim(sections[ordinality]),'')) end
       order by ordinality)
     from unnest(cleaned) with ordinality as items(label,ordinality)),
    actor)
  returning * into created;
  return created;
end;
$$;
revoke all on function public.publish_pretrip_template(text,text[],text[]) from public,anon;
grant execute on function public.publish_pretrip_template(text,text[],text[]) to authenticated;

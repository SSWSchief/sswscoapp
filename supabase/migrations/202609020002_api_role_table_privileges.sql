-- Grant the browser role the table privileges its policies already imply.
--
-- Row level security decides which rows a signed-in employee may touch, but a
-- policy cannot grant the underlying table privilege. This project has been
-- relying on the blanket grants an older Supabase project carries by default,
-- which are not part of this migration chain. The consequence is invisible
-- day to day and severe when it matters: a project rebuilt from these
-- migrations alone -- a restore, a fresh staging environment, a handover to
-- the client's own Supabase account -- comes up with an application that can
-- read nothing and write nothing, with no policy to explain why.
--
-- It was also masking the RLS test suite. `supabase test db` runs against a
-- freshly built database, so assertions about what the browser role may do
-- were aborting on privilege errors rather than exercising the policies. The
-- suite reported failure and CI reported success, because the step piped its
-- output through tee and took tee's exit status.
--
-- Each grant below is derived mechanically from the policies that already
-- exist on that table: a table gets exactly the operations it has a policy
-- for, and nothing else. This adds no access that RLS did not already permit.
-- Tables with no policy at all -- api_rate_limits, invoice_number_counters,
-- protected_administrators, training_datasets, unassigned_job_alerts -- are
-- deliberately absent and stay unreachable except through security-definer
-- functions and the service role.

grant select on public.absence_events to authenticated;
grant select on public.audit_log to authenticated;
grant select on public.company_settings to authenticated;
grant delete, insert, select, update on public.container_placements to authenticated;
grant delete, insert, select, update on public.customers to authenticated;
grant delete, insert, select, update on public.disposal_tickets to authenticated;
grant delete, insert, select, update on public.dumpsters to authenticated;
grant insert, select on public.export_audit to authenticated;
grant delete, insert, select, update on public.import_runs to authenticated;
grant select on public.invoice_jobs to authenticated;
grant select on public.invoice_line_items to authenticated;
grant select on public.invoices to authenticated;
grant select on public.job_activities to authenticated;
grant select on public.job_events to authenticated;
grant insert, select on public.job_notes to authenticated;
grant insert, select on public.job_photos to authenticated;
grant select on public.jobs to authenticated;
grant delete, insert, select, update on public.message_channel_members to authenticated;
grant delete, insert, select, update on public.message_channels to authenticated;
grant delete, insert, select, update on public.message_reads to authenticated;
grant insert, select on public.messages to authenticated;
grant select, update on public.notifications to authenticated;
grant insert, select on public.pretrip_submissions to authenticated;
grant select on public.pretrip_templates to authenticated;
grant delete, insert, select, update on public.price_list to authenticated;
grant delete, insert, select, update on public.push_subscriptions to authenticated;
grant delete, insert, select, update on public.sop_acknowledgements to authenticated;
grant select on public.sop_documents to authenticated;
grant select on public.stripe_webhook_events to authenticated;
grant select on public.time_entries to authenticated;
grant select on public.time_entry_corrections to authenticated;
grant insert, select on public.time_requests to authenticated;
grant delete, insert, select, update on public.trucks to authenticated;
grant select on public.users to authenticated;
grant delete, insert, select, update on public.vendors to authenticated;

-- Invoices are the one deliberate exception to "grant what the policy allows".
-- The Stripe migration revoked the writes on purpose so that every change goes
-- through the transactional RPCs, and the read grant above is all the office
-- needs. Re-stated here so the intent survives a later blanket grant.
revoke insert, update, delete on public.invoices from authenticated;

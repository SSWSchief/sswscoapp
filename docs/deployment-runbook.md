# Staging-to-Production Runbook

1. Create distinct Supabase staging and production projects and Vercel preview/production environments. Never point preview deployments at production data.
2. Rotate all development secrets. Store the publishable key in public variables and the secret key only in server-side encrypted variables.
3. Follow `docs/staging-verification.md`: pass blank-database CI, run the staging dry-run workflow, take a pre-migration backup, approve and apply every committed migration, then pass linked lint, behavioral pgTAP, generated-contract verification, and bootstrapped authenticated acceptance.
4. Configure exact Site/redirect URLs, custom SMTP with SPF/DKIM/DMARC, a 12-character minimum password, refresh-token rotation, short administrator sessions, Auth rate limits, and invitation/reset templates. Disable public signup. Administrator MFA is deliberately disabled; record that accepted risk and reapprove it at each release.
5. Configure the private `job-photos` bucket, retention, Storage backup, database PITR, redacted Vercel runtime logs, Supabase database/Auth/Storage alerts, and the scheduled GitHub check against `/api/health`.
5a. Configure Stripe test and live mode independently: account/business profile, branding, public website, support email/phone, statement descriptor, payout account, invoice email settings, card and US bank account payments, and a least-privilege webhook subscribed to `invoice.created`, `invoice.updated`, `invoice.finalized`, `invoice.sent`, `invoice.paid`, `invoice.payment_failed`, `invoice.payment_action_required`, `invoice.marked_uncollectible`, `invoice.voided`, `payment_intent.processing`, and `payment_intent.payment_failed`. Set the environment-specific `STRIPE_ACCOUNT_ID`, `STRIPE_EXPECTED_MODE`, and signing secret. Leave `STRIPE_INVOICING_ENABLED=false` in production until launch approval.
6. Confirm the maintenance scheduler for `/api/cron/maintenance`. The repository uses a once-daily Vercel cron so preview deployments pass on Hobby accounts; production dispatch alerts require either an approved Vercel plan that supports the 15-minute cadence or an approved external scheduler that sends `Authorization: Bearer $CRON_SECRET` to the same endpoint.
7. Put sanitized staging import files under ignored `imports/`. Run the default dry-run validator, review duplicates/errors/counts and the SHA-256 source hash, then apply with explicit `--apply`, `--environment`, `--project-ref`, and `--approved-hash` values. Production additionally requires `--confirm-production` with the exact project ref. Reconcile record counts and samples. The launch plan uses manual client entry, so do not run an import unless the client later approves one.
8. Complete physical-device, accessibility, offline/reconnect, camera, realtime, performance, and business UAT. Record every item listed in the traceability matrix.
9. Freeze source data. Back up production, apply the proven migration set, run the same import by source hash, reconcile, deploy the approved SHA, and execute role-specific smoke tests.
10. Keep the previous Vercel deployment available. The rollback owner decides within the recorded window whether to promote the prior deployment. Database rollback uses point-in-time recovery or a verified pre-migration backup in a replacement project; never reverse a migration in place.
11. Go live only after named business, security/privacy, and technical owners approve the evidence bundle.
11a. Before billing activation, record CPA approval of Nevada tax treatment, verify zero unexplained reconciliation differences, inspect successful webhook deliveries, and issue/pay/reconcile one controlled low-value live invoice. Then set production `STRIPE_EXPECTED_MODE=live` and `STRIPE_INVOICING_ENABLED=true`; update the production smoke expectations in the same approved release.
12. After the exact production commit is healthy, an administrator may provision
    `training-v1` from Settings. Remove it only through the same Settings panel;
    never delete production records with a prefix or wildcard query.

Raw client data, secrets, backup archives, and SMTP credentials must never be committed.

## Incident and rollback procedure

1. Declare the incident, record its start time, affected routes/roles, release SHA, Vercel deployment ID, and Supabase project ref. Never paste customer, employee, job-note, credential, or token data into the incident record.
2. Check `/api/health`, Vercel runtime logs by request ID, Supabase service health, Auth logs, and the most recent migration/cron audit entries. Logs are JSON and redacted; use the returned request ID to correlate a user-visible failure.
3. For an application-only regression, stop promotion and restore the previous known-good Vercel deployment. Keep the database forward-compatible.
4. For data/schema damage, disable mutations, take a current backup, restore the verified backup/PITR point to a separate Supabase project, validate record counts and critical workflows there, then switch environment variables during an approved maintenance window.
5. After recovery, run desktop/mobile smoke tests for all five staging identities, inspect logs for 24 hours, document root cause and corrective controls, and rotate any credential that may have been exposed.

## Backup and restore drill

Quarterly, restore the latest backup into an isolated project, apply remaining additive migrations, run database lint and pgTAP, reconcile representative table counts, verify private photo access, and execute authenticated browser acceptance. Record restore duration and evidence; a backup is not release evidence until this drill passes.

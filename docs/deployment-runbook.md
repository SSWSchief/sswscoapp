# Staging-to-Production Runbook

1. Create distinct Supabase staging and production projects and Vercel preview/production environments. Never point preview deployments at production data.
2. Rotate all development secrets. Store the publishable key in public variables and the secret key only in server-side encrypted variables.
3. Follow `docs/staging-verification.md`: pass blank-database CI, run the staging dry-run workflow, take a pre-migration backup, approve and apply migrations `202608060001` through `202608060008`, then pass linked lint, behavioral pgTAP, and bootstrapped authenticated acceptance.
4. Configure exact Site/redirect URLs, custom SMTP with SPF/DKIM/DMARC, 12-character minimum passwords, refresh-token rotation, administrator TOTP MFA, rate limits, and invitation/reset templates. Disable public signup.
5. Configure the private `job-photos` bucket, retention, Storage backup, database PITR, Vercel logs/alerts, Supabase database/Auth/Storage alerts, and a Vercel check against `/api/health`.
6. Put sanitized staging import files under ignored `imports/`. Run the default dry-run validator, review duplicates/errors/counts, apply to staging with the explicit `--apply` flag, and reconcile record counts and samples.
7. Complete physical-device, accessibility, offline/reconnect, camera, realtime, performance, and business UAT. Record every item listed in the traceability matrix.
8. Freeze source data. Back up production, apply the proven migration set, run the same import by source hash, reconcile, deploy the approved SHA, and execute role-specific smoke tests.
9. Keep the previous Vercel deployment available. The rollback owner decides within the recorded window whether to promote the prior deployment; database rollback uses the pre-migration restore procedure rather than reverse migrations.
10. Go live only after named business, security/privacy, and technical owners approve the evidence bundle.

Raw client data, secrets, backup archives, and SMTP credentials must never be committed.

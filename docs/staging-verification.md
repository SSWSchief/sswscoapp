# Staging Verification Procedure

The release uses two independent evidence lanes. Neither lane targets production.

## Lane A: blank-database proof

The `CI` workflow starts an isolated Supabase stack, resets it to an empty database, reapplies every committed migration, lints the resulting schema, runs schema and behavioral pgTAP tests, captures generated database types, and verifies the committed database contract contains every generated table and function. The `migration-evidence` artifact is required release evidence.

Migration 008 may be amended only while it has never been applied to a shared staging or production project. After its first shared staging application, freeze it and make every correction in a new forward migration.

## Lane B: approved staging proof

Configure the GitHub `staging` environment with required reviewers and these nine secrets. The
names are exact: the workflows read `secrets.<NAME>` literally, and a secret stored under a
different name is simply absent, which surfaces later as a confusing failure rather than a missing
credential.

- `STAGING_PROJECT_REF`
- `STAGING_DB_URL`
- `STAGING_SUPABASE_URL`
- `STAGING_SUPABASE_PUBLISHABLE_KEY`
- `STAGING_SUPABASE_SECRET_KEY`
- `PRODUCTION_PROJECT_REF` — supplied so the bootstrap can refuse a production target
- `STAGING_STRIPE_SECRET_KEY` (test or restricted test key)
- `STAGING_STRIPE_WEBHOOK_SECRET` (the staging endpoint's own secret, never production's)
- `STAGING_STRIPE_ACCOUNT_ID`

`STRIPE_EXPECTED_MODE=test` and `STRIPE_INVOICING_ENABLED=true` are **not** secrets. The acceptance
workflow sets both as literal environment values, which is deliberate: sending is enabled against a
test-mode key on staging while production keeps the flag off.

Run `Staging Database Verification` first with `apply_migrations=false`. Review the migration list and dry-run artifact. After approval and a staging backup, run it again with `apply_migrations=true`. This applies the pending migration set, then runs linked lint and pgTAP.

Run `Staging Acceptance` only after the database workflow is green. Its bootstrap checks that the configured URL matches `STAGING_PROJECT_REF`, refuses a matching production reference, and only runs inside GitHub Actions with `STAGING_ACCEPTANCE=true`. It creates reserved `E2E-*` profiles, fresh Auth identities, and isolated fixtures. Generated credentials are written to the current job environment without being printed.

The acceptance suite then verifies browser routes on Chromium and mobile WebKit plus direct authenticated RLS behavior for the password-only administrator policy, dispatcher defaults, revoked overrides, driver isolation, direct-write denial, and inactive profiles. Password-only administration is an explicitly accepted residual risk; strong passwords, short administrator sessions, Auth/application rate limits, immutable-owner protections, and audited administrator actions are mandatory compensating controls.

Billing acceptance additionally creates a per-job invoice and a multi-job statement, verifies reviewed recipient/terms/line content on the email, hosted page, and PDF, pays by test card and test ACH, observes processing/success/failure/partial/overdue display states, and exercises resend, revision, void, write-off, and on-demand reconciliation. Every selected job must remain unavailable to a second non-void invoice. Preserve webhook delivery evidence and the reconciliation result with the staging artifact.

## Promotion rule

Do not promote when a test is skipped, when either evidence artifact is missing, or when the staging migration history differs from the reviewed release. Production receives only the exact migration files and application commit proven by both lanes.

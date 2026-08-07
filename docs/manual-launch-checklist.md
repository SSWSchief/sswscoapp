# Manual Launch Checklist

Complete these steps in a staging-first sequence. Record the owner, date, evidence link, and approval for every item.

## 1. Credentials and ownership

- Rotate the database password and server secret that were shared during development.
- Update `.env.local`, staging hosting variables, and production hosting variables; never expose the server secret with `NEXT_PUBLIC_`.
- Remove old values from shared documents/chat history where organizational policy permits.
- Grant the development account least-privilege Supabase organization/project access.
- Maintain at least two organization owners and require MFA for every privileged account.

## 2. Staging project

- Create a separate Supabase staging project in the approved region.
- Apply migrations `202608060001` through `202608060008` in order.
- Run `supabase db lint --linked --level warning` and the pgTAP suite in `supabase/tests/rls.sql`.
- Retain the `migration-evidence` and `staging-database-evidence` workflow artifacts for the approved commit.
- Confirm the `job-photos` bucket is private, 10 MB-limited, and restricted to the approved image MIME types.
- Confirm Realtime publication contains only the intended production tables listed in migration `202608060008`.

## 3. Authentication and email

- Configure custom SMTP and validate SPF, DKIM, and DMARC for the approved sender domain.
- Set staging and production Site URLs plus exact redirect allowlists for `/auth/callback` and `/reset-password`.
- Approve password length/complexity, email confirmation, invitation expiry, session duration, CAPTCHA, and Auth rate limits.
- Verify invitation, resend/reset, expired-link, and deactivated-user behavior in staging.
- Enroll every administrator in TOTP MFA and verify that AAL1 sessions cannot access administrator routes, APIs, or database policies.

## 4. Hosting and operations

- Create Vercel production and preview environments with separate staging/production Supabase variables.
- Enable protected previews, assign deployment/rollback owners, and configure the custom domain.
- Approve the production maintenance scheduler: upgrade Vercel for the 15-minute cron cadence or configure an approved external scheduler against `/api/cron/maintenance` with `CRON_SECRET`.
- Add uptime monitoring, application error monitoring, alert destinations, log retention, and a documented rollback drill.
- Run `npm run check`, `npm run test:e2e`, and `npm audit --audit-level=high` in CI for the release commit.

## 5. Backups and retention

- Select a paid Supabase backup/PITR plan or approve a scheduled off-site database backup process.
- Define restore objectives and perform a documented staging restore test.
- Establish separate private Storage object backup/retention and deletion procedures.
- Approve retention for employees, jobs, photos, notes, audit history, time events, corrections, absences, and soft-deleted records.

## 6. Identities and role acceptance

- Protect the GitHub `staging` environment with required reviewers and configure the secrets listed in `docs/staging-verification.md`.
- Run the staging-only bootstrap to create fresh reserved acceptance identities; do not reuse employee or production accounts.
- Run authenticated Playwright journeys with no identity-based skips.
- Validate anonymous, inactive, driver, dispatcher, and admin RLS access; verify cross-driver job/photo/note isolation.
- Confirm at least two administrators retain access after role-change tests.

## 7. Client data

- Supply validated import files for customers, trucks, dumpsters, assignments, mileage, PTO reference values, and active jobs.
- Agree on unique identifiers, required fields, phone/address formats, timezone handling, and duplicate resolution.
- Rehearse import into staging, reconcile counts and samples, obtain written approval, then schedule production import.

## 8. Policy approval

- Approve job status transitions, cancellation reasons, dry-run handling, photo evidence rules, and dispatcher override authority.
- Approve time-clock sequencing, break expectations, exact-duration reporting, corrections, PTO/absence decisions, and the explicit exclusion of payroll calculations.
- Approve privacy/access rules for employee details, job notes, photos, audit records, and retention/deletion requests.

## 9. Acceptance and go-live

- Test on physical supported iPhone/iPad devices: portrait/landscape, large text, reduced motion, camera denial, slow/offline/reconnect behavior, and Home Screen mode.
- Perform keyboard/screen-reader accessibility review and resolve launch-blocking issues.
- Train administrators, dispatchers, and drivers using staging data.
- Run a parallel operational reconciliation period and compare jobs, photos, time events, and dispatcher alerts with the existing process.
- Obtain named business, security/privacy, and technical go-live approvals.
- Freeze imports, take a pre-launch backup, deploy the approved commit, execute smoke tests, and record the rollback decision window.

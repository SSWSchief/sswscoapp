# Manual Launch Checklist

Complete these steps in a staging-first sequence. Record the owner, date, evidence link, and approval for every item.

## 1. Credentials and ownership

- Rotate the database password and server secret that were shared during development.
- The workbook `ssw app data sheet and api.xlsx` contains credentials only. It is
  not an import source; rotate every credential it contains, verify the new
  values in all environments, then securely remove every copy.
- Update `.env.local`, staging hosting variables, and production hosting variables; never expose the server secret with `NEXT_PUBLIC_`.
- Remove old values from shared documents/chat history where organizational policy permits.
- Grant the development account least-privilege Supabase organization/project access.
- Maintain at least two client-controlled organization/application administrators in addition to the approved indefinite support administrator. Organization-provider MFA remains recommended even though application administrator MFA is disabled under the accepted application policy.

## 2. Staging project

- Create a separate Supabase staging project in the approved region.
- Apply every committed migration in order, including the release-hardening migration, from the exact release SHA.
- Run `supabase db lint --linked --level warning`, every pgTAP suite in `supabase/tests/`, and generated database-contract verification.
- Retain the `migration-evidence` and `staging-database-evidence` workflow artifacts for the approved commit.
- Confirm the `job-photos` bucket is private, 10 MB-limited, and restricted to the approved image MIME types.
- Confirm Realtime publication contains only the intended production tables listed in migration `202608060008`.

## 3. Authentication and email

- Configure custom SMTP and validate SPF, DKIM, and DMARC for the approved sender domain.
- Set staging and production Site URLs plus exact redirect allowlists for `/auth/confirm`, `/auth/callback`, and `/reset-password`.
- **The Site URL must be the public application domain.** On August 10, 2026 production's Site URL pointed at a Vercel SSO-protected preview domain, so every invitation link landed employees on a Vercel login page. Supabase also silently discards a `redirectTo` that is not on the allowlist and substitutes the Site URL, which hides the misconfiguration. **This recurred: on August 13, 2026 production was still misconfigured the same way** — the fix in `ec448b4` documented the failure but the dashboard setting was never corrected. Treat it as a standing regression risk, not a one-off. Verify with `npm run auth:check-redirect -- --email=<reserved account>`, which generates a link, sends no email, prints the requested and actual redirect, and exits non-zero on a mismatch.
- **Point the Invitation and Reset Password email templates at `/auth/confirm`**, using `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type={{ .Type }}&next=/reset-password`. Administrator-generated links are not PKCE and return their tokens in the URL hash fragment, which never reaches a server route; `/auth/confirm` redeems them with `verifyOtp`. The default `{{ .ConfirmationURL }}` template cannot work with server-side session handling.
- Approve password length/complexity, email confirmation, invitation expiry, session duration, CAPTCHA, and Auth rate limits.
- Verify invitation, resend/reset, expired-link, and deactivated-user behavior in staging.
- **Custom SMTP is deferred by agreement.** Until it is connected, onboarding runs on administrator-issued temporary passwords and `NEXT_PUBLIC_EMAIL_DELIVERY_ENABLED` stays `false`, which stops the sign-in screen offering a password reset it cannot deliver. The Site URL and redirect items above still apply — fix them now so links work the day SMTP is enabled. See the appendix in `docs/client-handoff.md`.
- Verify the approved password-only administrator policy: strong passwords, short sessions, Auth/application rate limits, immutable owners, active-profile enforcement, and audit records for administrator actions. Record MFA as an accepted residual risk.

## 4. Hosting and operations

- Create Vercel production and preview environments with separate staging/production Supabase variables.
- Enable protected previews, assign deployment/rollback owners, and configure the custom domain.
- Approve the production maintenance scheduler: upgrade Vercel for the 15-minute cron cadence or configure an approved external scheduler against `/api/cron/maintenance` with `CRON_SECRET`.
- Enable redacted runtime logs with approved retention, assign the GitHub production-smoke alert owner, and complete the documented rollback drill. Third-party monitoring is intentionally out of scope.
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
- Verify protected administrators are sourced from the service-managed registry,
  not client-side email matching, and cannot be downgraded or deactivated.

## 7. Client data

- Supply validated import files for customers, trucks, dumpsters, assignments, mileage, PTO reference values, and active jobs.
- Agree on unique identifiers, required fields, phone/address formats, timezone handling, and duplicate resolution.
- Rehearse import into staging, reconcile counts and samples, obtain written approval, then schedule production import.
- If the client is entering records manually, do not run a production import.
  Provision only `training-v1` from Settings, verify its five linked records,
  rehearse exact cleanup, and leave all safety content as client-approved data.

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

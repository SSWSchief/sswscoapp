# Production-Readiness Report

Date: August 7, 2026
Scope: three-layer production-readiness implementation and local verification

## Outcome

The repository now implements the production operations scope across core dispatch and the expanded modules. Runtime data is Supabase-only and fails closed; public/auth routes do not initialize operational providers; operational reads and Realtime refreshes are domain-scoped; routes and permissions share one registry; sensitive APIs use validated, bounded payloads and structured request-ID errors; and additive release migrations add indexes, application rate limiting, concurrency-safe maintenance, service-managed protected administrators, and a controlled removable training dataset.

This repository is code-complete for staging promotion. It is not approved for production go-live until the external release gates below have recorded evidence and named client approval. No migration was applied to a connected project, client data imported, identity invited, hosting environment deployed, or production setting changed during this implementation pass.

## Implemented release scope

- Authenticated dispatcher, driver, and administrator experiences with active-profile enforcement, safe redirects, registry-driven navigation, password-only administrator access under an explicit accepted-risk policy, protected administrator APIs, and compensating employee lifecycle rollbacks.
- Pacific-day dashboards, functional Today/Upcoming views, deterministic queues, unassigned work, scheduled asset reuse, transactional active-asset conflicts, audited job transitions, validated cancellation/override dialogs, and dry-run cancellation with required reason and asset release.
- Flexible time event sequencing, multiple completed breaks, corrections, PTO review, Pacific-day summaries, and immutable audit records.
- Production customer, employee, truck, and dumpster validation/lifecycle behavior with active-assignment safeguards.
- Manual invoice records in integer cents; audited, formula-safe CSV exports; operational/time/asset/invoice reports; truthful manual/operational AirTag locations; and administrator management oversight.
- Role-scoped Realtime messages and read receipts; versioned pre-trip templates/submissions and failure alerts; versioned SOP publishing and re-acknowledgement; and audited company settings.
- Expanded health/readiness and concurrency-safe scheduled-maintenance endpoints, structured redacted logging with request IDs, database-backed application rate limits, a scheduled GitHub production health check, staging acceptance CI, drift checks, rollback/restore guidance, and secure ignored import workspace.
- Obsolete feature/MFA UI, unused placeholder components, duplicate navigation/CSV utilities, and unused dependencies/exports were removed. Runtime-loaded `public/sw.js` is explicitly documented in dead-code configuration.
- Shared design tokens, focus treatment, responsive shells, consistent cards/tables/modals, and a field-first driver workspace replace the desktop phone-frame treatment while preserving the Silver State identity.

## Database source of truth

Migrations `202608060001` through `202608070001` remain the established baseline. Migrations `202608070002_release_hardening.sql` and `202608070003_client_launch_closeout.sql` are additive.

**Superseded August 10, 2026 — see the release record below. Both migrations are now applied to staging and production.**

The hardening migration adds:

- verified foreign-key, filter, chronological, status, assignment, and unread-message indexes;
- a private, RLS-enabled database rate-limit counter and fixed-search-path RPC; and
- an advisory-lock wrapper that makes scheduled maintenance concurrency-safe and retry-safe.

## Local verification evidence

- ESLint: passed with zero warnings.
- TypeScript strict check: passed.
- Vitest: 53 tests passed in 13 files. Expanded testable-surface coverage is 97.78% statements/lines, 89.15% branches, and 98.59% functions. Four additional CLI contract tests cover import schema, duplicates, hashing, and target guards.
- Dead-code analysis: passed with no unexplained findings.
- Next.js 15.5.23 production build: passed, including 31 generated pages, middleware, and health/export/maintenance endpoints.
- Dependency audit: zero known vulnerabilities.
- Public Playwright checks are available locally; authenticated role journeys are enforced in the staging workflow and require approved staging identities.

## Required release evidence

- Apply all migrations to staging, then pass database lint, generated-contract verification, `EXPLAIN ANALYZE` with realistic volume, and the pgTAP/RLS abuse suite. The local Docker daemon is unavailable, so migration execution and pgTAP are not claimed here.
- The dedicated `sswscoapp-staging` Vercel project exists. Create/link a distinct Supabase staging project in the organization that owns production, then configure separate Vercel staging variables, exact Auth redirect allowlists, custom SMTP/templates, approved password/Auth rate limits, short administrator sessions, private Storage, protected secrets, and log ownership.
- Approve and verify the production maintenance cadence. The connected Vercel preview account only accepts daily cron schedules; 15-minute dispatch maintenance alerts require a Vercel plan that supports sub-daily cron or an approved external scheduler using `CRON_SECRET`.
- Run the authenticated admin, dispatcher, driver, inactive, and reduced-permission Playwright suites against staging on Chromium and mobile WebKit with no production-critical skips.
- Rehearse client import dry-run/application/reconciliation, pre-migration backup, database and private-photo restore, failed deployment rollback, credential rotation, and production smoke tests. Rotate workbook-held credentials only after staging is operational.
- Complete physical iPhone/iPad and desktop UAT, keyboard/screen-reader and large-text checks, camera denial, slow/offline/reconnect, PWA update, and realistic-load verification.
- Record named business, security/privacy, and technical approvals.

## Release decision

The application code gate passes locally and is ready for controlled staging promotion. Production promotion remains blocked by the missing Supabase staging project/access, unexecuted migration/RLS/load evidence, authenticated multi-role visual/E2E evidence, restore/rollback rehearsal, physical-device acceptance, 24-hour log review, and named approvals. Production has not been changed by this pass.

---

# Release Record — August 10, 2026

This section supersedes the August 7 statements above wherever they conflict. Production **was** changed by this pass.

## What was released

Commit `cef2fa5` merged to `main` as `9bd05ff`. The merge commit's tree is byte-identical to `cef2fa5`, the commit proven by staging acceptance. Production serves `release: 9bd05ffa8c9f`.

Three defects were repaired first, all in test and CI code rather than the application:

- `e2e/pilot-authenticated.spec.ts` asserted page identity with `getByText`, which resolved to hidden `hidden md:flex` sidebar links on the tablet and mobile-safari projects, and asserted a `"Management Portal"` heading that never existed (the page renders `"Management Overview"`). Assertions now target the Topbar `h1` through `getByRole("heading", { level: 1 })`. This was the sole cause of five consecutive Staging Acceptance failures.
- `.github/workflows/production-smoke.yml` read `data.database.status === "ok"`; `/api/health` returns `data.dependencies.database.status === "reachable"`. The check would have failed on every scheduled run. It now also requires a `release` SHA so a stale deployment is caught.
- `playwright.config.ts` used only the `github` reporter in CI, which writes no files. Because `test-results/` populates solely on failure, a passing run uploaded an empty evidence artifact, making the artifact requirement in `docs/staging-verification.md` unsatisfiable. CI now emits `html` and `json` reports.

## Evidence

- Staging Acceptance run `31420065292`: **28 passed, 0 failed**. The 8 skips are the RLS spec's deliberate `browserName !== "chromium"` guard on API-level tests (4 tests × 2 non-chromium projects). No identity-based and no production-critical skips.
- CI green on every commit in the release.
- Production Health Smoke run `31423740176`: passed against the deployed release.

## Migrations applied to production

Applied to `doofdntdobpixqmcqfnm` on August 10, 2026 using the sequence in `.github/workflows/staging-database-verification.yml`, run locally.

1. Pre-apply gate: `supabase migration list` confirmed `202608060001`–`202608070001` recorded in both Local and Remote columns. History was CLI-tracked with no dashboard-applied drift, so `db push --include-all` was safe.
2. Backup: full `pg_dump` of `public`, `auth`, and `storage` (59 tables, 57 functions, 28 data blocks). Supabase's `db dump` requires Docker, which was unavailable; libpq's `pg_dump` was used instead.
3. Dry run confirmed exactly two pending migrations.
4. `202608070002` and `202608070003` applied. All twelve migrations now recorded.

Post-apply verification confirmed every new object. Note that `customer_active_job_counts` is a set-returning function that PostgREST omits from its OpenAPI document; it was verified through `pg_proc` and a live RPC call returning 200, not through the schema listing.

Applying migrations ahead of the deploy was required, not incidental: `src/app/api/cron/maintenance/route.ts` calls `run_scheduled_maintenance_safe`, which did not exist in production until this step.

## Production verification after deploy

- `/api/health` returns the `data.dependencies.database` envelope with `release: 9bd05ffa8c9f`.
- `/login` serves `script-src 'self' 'nonce-…' 'strict-dynamic'`, HSTS with preload, and `X-Frame-Options: DENY`.
- `/dispatcher/jobs` redirects unauthenticated requests to `/login?next=…`.
- `/api/cron/maintenance` rejects unauthenticated requests with 401.
- React hydration verified under the nonce CSP on desktop and at a 375-pixel viewport by exercising a client-side control.
- Data intact: 2 users, 1 settings row, 1 pre-trip template, 2 protected administrators. No operational records.

## Still open before client testing

- **Rotate every credential in the `ssw app data sheet and api.xlsx` workbook**, per `docs/manual-launch-checklist.md` §1. The database password was exposed during this pass. Rotate the database password first, then the publishable and secret keys, updating Vercel variables before revoking the old values.
- Public signup is still enabled on the production project and must be disabled.
- Custom SMTP with SPF, DKIM, and DMARC is not configured. This blocks employee invitations and password resets, and therefore blocks creating the dispatcher and driver accounts the client needs in order to test anything beyond the administrator view.
- Site URL and the exact redirect allowlist for `/auth/callback` and `/reset-password` need confirming.
- `CRON_SECRET` presence in Vercel production is unverified; the endpoint returns 401 both when the secret is absent and when it is wrong, so this cannot be checked externally.
- Maintenance runs once daily rather than every 15 minutes, so unassigned-job dispatch alerts will not fire promptly during testing.
- Administrator MFA remains deliberately disabled and requires re-approval before go-live.
- Backup/PITR selection, the restore drill, physical-device UAT, the accessibility review, and named approvals remain as listed in `docs/manual-launch-checklist.md`.

# Production-Readiness Report

Date: August 7, 2026
Scope: three-layer production-readiness implementation and local verification

## Outcome

The repository now implements the production operations scope across core dispatch and the expanded modules. Runtime data is Supabase-only and fails closed; public/auth routes do not initialize operational providers; operational reads and Realtime refreshes are domain-scoped; routes and permissions share one registry; sensitive APIs use validated, bounded payloads and structured request-ID errors; and the additive release-hardening migration adds indexes, application rate limiting, and concurrency-safe maintenance.

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

Migrations `202608060001` through `202608070001` remain the established baseline. Migration `202608070002_release_hardening.sql` is additive and must first be applied and tested in the separate staging Supabase project. It has not been applied remotely by this pass.

The hardening migration adds:

- verified foreign-key, filter, chronological, status, assignment, and unread-message indexes;
- a private, RLS-enabled database rate-limit counter and fixed-search-path RPC; and
- an advisory-lock wrapper that makes scheduled maintenance concurrency-safe and retry-safe.

## Local verification evidence

- ESLint: passed with zero warnings.
- TypeScript strict check: passed.
- Vitest: 42 tests passed in 9 files. Critical-scope coverage is 98.92% statements, 93.45% branches, 95.23% functions, and 98.92% lines.
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

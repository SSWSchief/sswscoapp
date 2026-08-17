# SSWSCO Overwatch — Production Operations

Supabase-backed internal operations platform for Silver State Waste Solutions. The production scope covers authentication, dispatch/jobs, customers, assets, employees and permissions, private job photos and notes, realtime alerts, flexible audited time events, corrections, absences, invoice records, reports/exports, locations/AirTags, management oversight, internal messaging, pre-trip inspections, SOP acknowledgements, and company settings.

Payment processing, payroll, route optimization, customer portals, live GPS, fleet-maintenance automation, and AI dispatch remain explicitly outside this release.

## Stack

Next.js 15.5, React 19, TypeScript, Tailwind CSS, and Supabase (PostgreSQL, Auth, Realtime, private Storage, and Row Level Security).

## Local setup

```bash
cp .env.example .env.local
npm ci
npm run dev
```

Configure the public Supabase URL and publishable key plus the server-only secret in `.env.local`. Never expose the secret with a `NEXT_PUBLIC_` prefix. Apply migrations in order from `supabase/migrations/` before signing in.

## Verification

```bash
npm run check
npm run test:e2e
npm run db:lint
npm audit
```

`npm run check` runs ESLint, TypeScript, coverage-gated unit tests, dead-code analysis, and a production build. Playwright authenticated journeys require the isolated staging identities documented in the manual launch checklist. Supabase database lint requires a running local stack or an explicit database URL.

## Operational behavior

- Live Supabase data is the only production data source. Seed fixtures are isolated to development/tests and are never a runtime fallback.
- When connectivity or session state is unhealthy, loaded records remain visible in memory but all mutations fail closed. Private records are never persisted offline.
- The service worker caches only public shell/static assets; authenticated routes, APIs, Supabase responses, photos, and writes are network-only.
- Asset locations are recorded by people, never fed by Apple. Apple publishes no AirTag API, so Overwatch cannot read tag positions; `asset_location_checks` is an append-only, self-attributed log of who confirmed an asset's location, when, and how (Find My reading, driver report, or seen in person). Checks age out of "confirmed recently" after 24h and out of "aging" after 72h. The "Open Find My" button hands off to Apple's app on iPhone/iPad/Mac only — it addresses the Items list rather than one tag, and it is hidden elsewhere because iCloud.com does not show AirTags at all.
- The Management Overview is an administrator-only workspace whose drill-downs enter the same permission-enforced operations shell. Administrator MFA is intentionally disabled under the current release policy; active-profile, role, immutable-owner, rate-limit, short-session, and audit controls are the compensating safeguards. This accepted residual risk is reviewed before every production release.
- Driver time events support clock-out after clock-in and zero or more complete break pairs in `America/Los_Angeles`; impossible sequences are rejected. Totals are exact and have no payroll, overtime, rounding, or automatic deductions.
- Driver completion requires a private-bucket photo. Dispatcher completion without a photo requires an audited reason.

## Mobile acceptance

The application includes safe-area, dynamic viewport, touch target, camera input, PWA manifest, and offline-state handling. Before launch, test on the oldest supported physical iPhone and iPad in portrait/landscape, large text, reduced motion, interrupted connectivity, camera denial, and Home Screen mode.

## Production handoff

See `docs/production-readiness-report.md` and `docs/manual-launch-checklist.md` for implementation status, verification evidence, limitations, and client-controlled launch steps.
The exact blank-database, linked-staging, and authenticated acceptance sequence is documented in `docs/staging-verification.md`.

`docs/client-user-guide.md` is the illustrated how-to handed to employees, published alongside it as `client-user-guide.html` and `client-user-guide.pdf`. Regenerate all three against **staging**:

```bash
npm run docs:guide:prepare    # training dataset, practice driver, published checklist and SOP
GUIDE_DRIVER_EMAIL=training-driver@sswsco.invalid npm run docs:guide
```

Both scripts read `.env.local` and refuse to run against the production project. Sessions come from single-use links minted by the Supabase admin API, so no employee password is ever entered or stored. `scripts/prepare-guide-fixtures.mjs` is idempotent and creates only labelled training records.

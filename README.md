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

`npm run check` runs ESLint, TypeScript, unit tests, and a production build. Playwright authenticated journeys require the staging identities documented in the manual launch checklist. Supabase database lint requires a running local stack or an explicit database URL.

## Operational behavior

- Live Supabase data is the only production data source. Seed fixtures are isolated to development/tests and are never a runtime fallback.
- When connectivity or session state is unhealthy, loaded records remain visible in memory but all mutations fail closed. Private records are never persisted offline.
- The service worker caches only public shell/static assets; authenticated routes, APIs, Supabase responses, photos, and writes are network-only.
- The Management Overview is an administrator-only dashboard whose drill-downs enter the same permission-enforced operations workspace. TOTP verification is temporarily disabled during acceptance testing; active-profile and administrator-role checks remain enforced.
- Driver time events support clock-out after clock-in and zero or more complete break pairs in `America/Los_Angeles`; impossible sequences are rejected. Totals are exact and have no payroll, overtime, rounding, or automatic deductions.
- Driver completion requires a private-bucket photo. Dispatcher completion without a photo requires an audited reason.

## Mobile acceptance

The application includes safe-area, dynamic viewport, touch target, camera input, PWA manifest, and offline-state handling. Before launch, test on the oldest supported physical iPhone and iPad in portrait/landscape, large text, reduced motion, interrupted connectivity, camera denial, and Home Screen mode.

## Production handoff

See `docs/production-readiness-report.md` and `docs/manual-launch-checklist.md` for implementation status, verification evidence, limitations, and client-controlled launch steps.
The exact blank-database, linked-staging, and authenticated acceptance sequence is documented in `docs/staging-verification.md`.

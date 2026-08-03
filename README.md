# SSWS — Internal Operations Platform (Phase 1)

Foundation + design skeleton for **Silver State Waste Solutions**' internal
operations platform. This replaces phone calls, texts, and paper notes with one
system for dispatchers (desktop) and drivers (mobile).

> **Status: browser-persistent demo.** Screens start from local mock data and
> interactive walkthrough changes are saved in `localStorage`. No backend,
> secure auth, realtime service, or third-party platform is connected yet.

## Stack

Per the PRD: **Next.js (App Router) · React · TypeScript · Tailwind CSS**.
Planned backend: **Supabase** (Postgres, Auth, Realtime), hosted on Vercel.

## Getting started

```bash
npm install
npm run dev
```

Open http://localhost:3000 and pick **Dispatcher** or **Driver**.

## What's included

**Dispatcher (desktop)** — Login, Dashboard, Jobs, Job Details, Create/Edit Job,
Customers, Trucks, Dumpsters, Employees, Time Clock, Reports, Map (Phase-2
placeholder), Settings.

**Driver (mobile)** — My Jobs, Job Details, acknowledgement-required alerts,
Electronic Pre-Trip placeholder, Time Clock, Messages, SOPs, and Profile,
rendered inside a phone frame on desktop for walkthroughs.

## Mobile and iOS readiness

- Responsive dispatcher, management, and driver layouts support phone, tablet,
  and desktop widths without horizontal page scrolling.
- iPhone/iPad safe areas, dynamic viewport heights, keyboard-friendly form
  controls, and minimum touch targets are applied across shared navigation,
  dialogs, forms, alerts, and sticky actions.
- The app has a web manifest, Apple touch icon, standalone display metadata,
  install guidance, service-worker update handling, and a truthful offline
  fallback screen. On iOS, use Safari's **Share → Add to Home Screen** action.
- Driver workflows use native phone links, platform-aware map directions, and
  camera/photo-library inputs. Selected photos are local previews only until
  Supabase Storage is connected.
- The service worker caches only the public application shell and static brand
  assets. It does not cache private records or queue operational changes.

The demo should be tested on the oldest iOS/Safari version the client intends
to support before launch. Production acceptance should include a physical
iPhone and iPad, landscape and portrait orientation, large text, reduced
motion, slow/interrupted connectivity, camera permission denial, and installed
Home Screen mode.

## Project structure

```
src/
  app/
    page.tsx              Role picker (skeleton entry)
    login/                Screen 1
    dispatcher/           Desktop shell (sidebar) + all dispatcher screens
    driver/               Mobile shell (bottom nav) + all driver screens
  components/
    ui/                   Design system: Button, Card, StatusBadge, Table, Modal, Field, …
    dispatcher/           Sidebar, Topbar, Create Job / Add Asset modals
    driver/               BottomNav, MobileHeader
  lib/
    types.ts              Domain types — mirror the 8 PRD database tables 1:1
    mock-data.ts          Seed data (skeleton only)
    data.ts               Data-access seam — swap these functions for Supabase queries
    utils.ts              Formatting + helpers
    supabase/README.md    How the backend drops in later
```

## Storage seam

Static lookups come through `src/lib/data.ts`; interactive demo state comes
through `DemoStateProvider`. The provider exposes storage-agnostic operations
for jobs, notifications, acknowledgements, and employee access. When the client
is ready, those operations become Supabase queries/subscriptions while screens
keep the same behavior.

## Design tokens

Colors, status badges, and typography come straight from the Phase 1 wireframes
(`reference images/`) and live in `tailwind.config.ts`.

## Not in this phase

Anything requiring a connected platform or client input: real auth, live
cross-device realtime data, deployment, secure photo uploads, background sync,
offline write queues, and the PRD Phase-1 Non-Goals (billing, invoicing,
payroll, customer portal, route optimization, live GPS, automated fleet
maintenance, AI dispatching, and full reporting). Operating-system push
notifications are also deferred. The current access-control screen is
demonstrative and is not a security boundary until Supabase Auth, database Row
Level Security, and server-side authorization are connected.

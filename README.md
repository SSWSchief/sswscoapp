# SSWS — Internal Operations Platform (Phase 1)

Foundation + design skeleton for **Silver State Waste Solutions**' internal
operations platform. This replaces phone calls, texts, and paper notes with one
system for dispatchers (desktop) and drivers (mobile).

> **Status: design skeleton.** Every screen renders from local mock data. No
> backend, auth, or third-party platform is connected yet. This is intentional —
> it's the work we can complete independently while timeline and payment are
> finalized. The real build swaps the mock layer for Supabase without touching
> the UI.

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

**Driver (mobile)** — My Jobs, Job Details, Time Clock, Messages, Profile,
rendered inside a phone frame on desktop for walkthroughs.

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

## The one seam that matters

The UI imports data **only** from `src/lib/data.ts`. Today those functions
return mock data. When the client is ready, each becomes a Supabase query with
the same signature — see `src/lib/supabase/README.md`. That's what makes "build
now, connect later" possible without a rewrite.

## Design tokens

Colors, status badges, and typography come straight from the Phase 1 wireframes
(`reference images/`) and live in `tailwind.config.ts`.

## Not in this phase

Anything requiring a connected platform or client input: real auth, live
realtime, deployment, and the PRD Phase-1 Non-Goals (billing, invoicing,
payroll, customer portal, route optimization, live GPS, fleet maintenance, AI
dispatching, full reporting, push notifications).

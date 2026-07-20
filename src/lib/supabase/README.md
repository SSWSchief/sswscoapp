# Supabase integration (Phase 1 — not yet connected)

This folder is a placeholder for the Supabase client and typed queries. During
the **design-skeleton** phase nothing here is wired up — the app reads from
`src/lib/data.ts` (mock layer) instead.

## When the client is ready to proceed

1. Provision a Supabase project and create the tables from the PRD (§5):
   `users`, `customers`, `jobs`, `trucks`, `dumpsters`, `time_entries`,
   `job_photos`, `job_notes`. The TypeScript interfaces in
   `src/lib/types.ts` are written to match these tables 1:1.
2. Add credentials to `.env.local` (see `.env.example`).
3. Install the client: `npm install @supabase/supabase-js @supabase/ssr`.
4. Implement `client.ts` (browser) and `server.ts` (RSC/route handlers).
5. Replace the bodies of the functions in `src/lib/data.ts` with Supabase
   queries. Their signatures already match, so **no UI component changes are
   required**.
6. Enable Row Level Security so drivers can only read their own jobs
   (PRD: "Drivers cannot edit other jobs").
7. Subscribe to Supabase Realtime on the `jobs` table for the live-update
   requirement ("No page refresh required").

Keeping the data seam in one file is what lets Phase 1 be built now and the
backend dropped in later without a rewrite.

# Supabase integration (Phase 1 — not yet connected)

This folder is a placeholder for the Supabase client and typed queries. During
the **design-skeleton** phase nothing here is wired up — the app reads from
`src/lib/data.ts` (mock layer) instead.

## When the client is ready to proceed

1. Provision a Supabase project and create the core tables from the PRD (§5):
   `users`, `customers`, `jobs`, `trucks`, `dumpsters`, `time_entries`,
   `job_photos`, `job_notes`, plus `notifications` and employee permission
   overrides for the approved demo additions. Use the interfaces in
   `src/lib/types.ts` as the application contract.
2. Add credentials to `.env.local` (see `.env.example`).
3. Install the client: `npm install @supabase/supabase-js @supabase/ssr`.
4. Implement `client.ts` (browser) and `server.ts` (RSC/route handlers).
5. Replace static functions in `src/lib/data.ts` and the storage operations in
   `DemoStateProvider` with Supabase queries/mutations while retaining their
   public signatures.
6. Enable Row Level Security so drivers can only read their own jobs
   (PRD: "Drivers cannot edit other jobs").
7. Subscribe to Supabase Realtime on the `jobs` table for the live-update
   requirement ("No page refresh required").
8. Persist notification acknowledgements and enforce employee permissions on
   the server/RLS layer; hiding navigation alone is not authorization.
9. After the client supplies its pre-trip form, add the inspection schema,
   submission records, and an audited mileage update on the assigned truck.

Keeping the data seam in one file is what lets Phase 1 be built now and the
backend dropped in later without a rewrite.

# Supabase integration

The browser and server clients live in this directory. Environment variables
are documented in the repository `.env.example`; the server secret must never
be exposed through a `NEXT_PUBLIC_` variable.

The ordered files in `supabase/migrations/` are the database source of truth. They include:

- Phase 1 operations tables and indexes
- employee/Auth account linking by email
- role-aware Row Level Security
- audited driver status and dry-run functions
- Realtime tables for jobs, alerts, field evidence, time, and assets
- a private `job-photos` bucket with signed-URL access

To connect a remote project:

```bash
supabase link --project-ref <project-ref>
supabase db push
```

Create each approved `public.users` employee record before inviting the same
email through Supabase Auth. The Auth trigger links the two records. Drivers can
only read assigned jobs; dispatcher/admin users manage operational records.

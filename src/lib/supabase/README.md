# Supabase integration

The browser and server clients live in this directory. Environment variables
are documented in the repository `.env.example`; the server secret must never
be exposed through a `NEXT_PUBLIC_` variable.

The ordered files in `supabase/migrations/` are the database source of truth. They include:

- production operations and expanded-module tables and indexes
- employee/Auth account linking by email
- role-aware Row Level Security
- audited driver status and dry-run functions
- Realtime tables for jobs, alerts, field evidence, time, assets, messages, inspections, SOPs, invoices, and settings
- private `job-photos` and `employee-photos` buckets with signed-URL access
- `users.activated_at`, stamped by an Auth trigger on first sign-in, which is
  what the app reads to show an employee as Pending rather than Active. The
  same trigger adopts an unlinked profile by email, because `link_auth_user`
  can only link accounts that were inserted after their profile existed
- `notifications.pushed_at`, the claim marker that keeps Web Push delivery from
  alerting anyone twice for the same event

To connect a remote project:

```bash
supabase link --project-ref <project-ref>
supabase db push
```

Create each approved `public.users` employee record before inviting the same
email through Supabase Auth. The Auth trigger links the two records. Drivers can
only read assigned jobs; dispatcher/admin users manage operational records.

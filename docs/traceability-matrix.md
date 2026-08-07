# Production Traceability Matrix

Every release row must have UI, data-boundary authorization, audit behavior, and automated acceptance evidence. “Manual” rows require dated evidence in the launch record.

| Workflow | Roles | UI / interface | Database boundary | Automated evidence |
|---|---|---|---|---|
| Sign in, reset, deactivate | All / Admin | `/login`, reset, employee access | Auth profile + middleware + admin API | public/auth and authenticated E2E |
| Schedule and assign work | Admin, Dispatcher | Dashboard, jobs, job editor | `create_job`, `edit_job`, `assign_job`; jobs are RPC-write-only | job-date unit tests, pgTAP, role E2E |
| Execute or dry-run job | Driver | Driver queue and job detail | transition trigger, `update_assigned_job_status`, `log_assigned_job_dry_run` | transition unit/pgTAP/E2E |
| Photos and notes | Assigned driver, staff | Job detail | private Storage + job-scoped RLS | Storage/RLS and camera E2E |
| Customers and assets | Authorized staff | customer/truck/dumpster screens | module permission policies + audit triggers | pgTAP and dispatcher E2E |
| Time, corrections, PTO | Employee, reviewers | time clock and absence screens | RPC-only time events, scoped requests, immutable corrections | time unit/pgTAP/E2E |
| Invoice records | Admin | invoices | `invoices` permission + audit trigger | invoice/CSV unit and admin E2E |
| Reports and exports | Authorized staff | reports, `/api/exports/*` | `reports` permission + `export_audit` | CSV safety and role E2E |
| Locations and AirTags | Authorized staff | locations workspace | scoped asset reads/updates | dispatcher E2E |
| Management oversight | Admin | `/management` | admin route boundary and RLS | admin E2E |
| Team messages | Members / Admin | dispatcher and driver messages | channel membership, sender identity, announcement policy | message RLS and role E2E |
| Pre-trip inspections | Driver, staff reviewer | pre-trip form | versioned templates, own submission, failure trigger | pre-trip RLS/E2E |
| SOP publication/ack | Admin, Driver | settings and SOP library | versioned publication and own acknowledgement | SOP RLS/E2E |
| Company settings | Admin | settings | admin-only update + audit | settings RLS/admin E2E |
| Operational import | Admin/service role | CLI | transactional `apply_operations_import`, source hash idempotency | dry-run validation + staging rehearsal |
| Health and deployment | Operations owner | `/api/health` | server-only database probe | Vercel checks and smoke test |

## Release evidence

- CI run URL and commit SHA
- Staging authenticated acceptance run URL
- pgTAP output and migration lint output
- Import dry-run and reconciliation reports
- Backup restore and rollback rehearsal record
- Physical iPhone/iPad accessibility checklist
- Named business, security, and technical approvals


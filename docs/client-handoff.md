# Client Handoff and Full-Launch Guide

Use this guide only after the exact release commit passes blank-database CI and
authenticated staging acceptance. Production starts with the two approved
administrators, Company Announcements, Dispatch, and at most one controlled
training dataset. Automated E2E identities never enter production.

## Administrator setup order

1. Confirm the company address, phone, email, Pacific time zone, invoice prefix,
   message retention, and approved Auth/session policy.
2. Confirm Austin Marshall and Tehron Porter can sign in with unique strong
   passwords. Tehron is the approved indefinite support administrator. Add and
   verify a second client-controlled administrator before staff rollout.
3. Enter real employees and verify role, access preset, individual overrides,
   phone, and active status before sending password setup emails.
4. Enter real trucks, dumpsters, mileage, maintenance information, and current
   assignments. Then enter initial customers and every open launch-day job.
5. Publish only client-approved pre-trip and SOP content. Training or generic
   safety language must not be published as company policy.
6. Review dry-run reasons, job evidence, dispatcher overrides, time corrections,
   privacy, retention, and incident contacts with the named business owner.

## Controlled training data

Settings → Training Data creates one linked customer, truck, dumpster, pending
unassigned job, and zero-dollar draft invoice. It creates no login, message,
time record, photo, SOP, or pre-trip checklist. All records are clearly labeled
`TRAINING` and are tracked under dataset key `training-v1`.

To remove it, choose **Remove Training Data**, type `DELETE TRAINING DATA`, and
confirm. The database validates the exact registry before deleting anything,
deletes all five records in one transaction, and records the action in audit
history. Repeating either create or remove is safe.

## Staff launch

- Send invitations only after each employee profile has been reviewed.
- Have every user complete sign-in and password setup during the approved
  onboarding window. Do not share passwords or reuse staging credentials.
- Administrators verify Settings, Employees, Management, exports, and audit
  access. Dispatchers verify customers, assets, jobs, assignments, messages,
  time review, and reports. Drivers verify assigned work, photos, notes, time,
  messages, pre-trip, SOPs, profile, offline/reconnect, and sign-out.
- Reconcile the first live jobs and time events against the previous process.
  Keep the prior Vercel deployment available throughout the rollback window.

## Support and incident handling

Report the affected role, route, approximate time, and the request reference
shown in the error. Never place passwords, keys, employee/customer details,
phone numbers, job notes, or photos in an incident ticket. The support owner
checks `/api/health`, Vercel runtime logs by request ID, Supabase service/Auth
logs, and recent audit/maintenance results before deciding whether to restore
the prior application deployment or invoke the database restore runbook.

Application administrator MFA is intentionally disabled and indefinite support
administrator access is intentionally retained. These are accepted residual
risks; strong unique passwords, short sessions, rate limits, protected-admin
enforcement, and administrator audit records are mandatory compensating controls.

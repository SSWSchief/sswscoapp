# End-to-end pass through Austin's eyes (Nov 8, 2026)

Every report Austin has sent since July was re-read (email threads from 6/23
through 10/9, plus the fixes shipped in PRs 32–47), then the app was walked
flow by flow looking for the same *kinds* of failure, and production data was
read (read-only) for records that are stuck or never written.

## What Austin's reports have in common

Almost none of his reports were about a feature being missing. They fall into
six repeating classes, and each class is where the next report will come from:

| Class | Past examples | How it reaches Austin |
| --- | --- | --- |
| A page reads data its route never loads | "Loading tax rate…" forever on Invoices (10/7) | A screen is empty or stuck loading, but only sometimes |
| A record never closes | Cans stuck Out with no Pick-Up job (10/19); a shift with no clock-out locking the time clock (10/14) | A dashboard number that is wrong for weeks |
| A guard blocks the office | Inactive driver blocked Arrived on #1069; reason boxes (11/6) | "It won't let me" |
| A control off-screen on a phone | Profitability Costs button (10/16) | "Where do I enter…" |
| Config drifts outside the code | Supabase Site URL (Aug), Resend domain (now) | Emails quietly stop |
| He is on a stale build | Messages bugs already fixed (8/24, 9/6) | A report about code that no longer exists |

## Findings, most urgent first

### 1. Customer confirmation emails failed on Nov 1 and were never retried

Production: the only confirmation ever delivered was #1067 on Oct 12. Every
send on Nov 1 (#1068 ×3, #1069, #1070) failed with *Resend 403: The sswsco.com
domain is not verified.*

**Checked in Resend on Nov 8: the sender works again.** Both keys (`sswscoapp`
for the app, `supabase-smtp-production` for Supabase invitations) are in the
same Resend team, and sswsco.com is Verified there. The team's logs show eight
403s on Nov 1, including an employee invitation. Three days later, on Nov 5,
the same invitation from the same `notifications@sswsco.com` sender went
through (200). So the domain was briefly unverified around Nov 1 and has been
fixed since. No key or Vercel change is needed.

What is still wrong: the failed confirmations just sit as "Email not sent"
on the job until someone presses Resend. #1070 and #1071 are deliveries
scheduled for Nov 9 with no delivered confirmation. Nothing alerts the
office, and nothing retries.

### 2. Three pages read data their route never loads (fixed in this PR)

Same class as "Loading tax rate…". They work when reached from a page that
happened to load the data first, and sit empty after a refresh, a reopen of
the Home Screen app, or arriving from another page:

- **Pricing & Terms** (`/dispatcher/pricing`): "Loading rates…" forever.
- **Office Pre-Trip review** (`/dispatcher/pre-trip`): no inspections, trucks
  or drivers, so it reads as "nobody did a pre-trip".
- **Driver Post-Trip** (`/driver/post-trip`): no checklist and no trucks, so a
  driver cannot submit one at all.

A new test (`route-domains.coverage.test.ts`) reads every portal page and the
components it imports and fails if any of them reads data its route does not
load, so this class cannot come back silently.

### 3. Lists that would start dropping new records as the business grows (fixed in this PR)

- **Invoices** loaded the 50 *earliest* invoices by due date. Production holds 7
  so far (numbers up to INV-000018); from the 51st, new invoices would have disappeared
  from the Invoices page, open receivables on the Dashboard and Management
  Overview, and revenue on Reports. Now every unpaid invoice loads, plus the
  last year of paid and void ones.
- **Absence calendar** loaded the 50 *oldest* absences, so the calendar would
  have stopped showing new ones after the 50th. Now newest 500.

### 4. Invoices showed Overdue on the evening of their due date (fixed in this PR)

The overdue check compared the due date with the UTC date, which rolls over at
4 PM (5 PM in summer) in Las Vegas.

### 5. Promised on Oct 10, not built yet

From "Update #4", under *Coming next* — Austin said yes to each:

1. Confirmation emails show the price ("it's technically a quote").
2. Email the customer when a job is cancelled.
3. Reminder email the day before a job.
4. Quotes by email and text, from his sample quote, 7-day expiry.
5. Charts on Profitability.

Items 2 and 3 need a small migration (a reminder-sent marker) and ride
the existing 8 AM maintenance cron.

### 6. Usage gaps Austin probably doesn't know about (questions, not code)

- **No pre-trip or post-trip inspection has ever been submitted** in
  production, across 6 completed jobs. Post-trip was blocked by finding 2.
  Does Austin want drivers reminded, or required, to do one before their
  first job of the day?
- Two questions from Oct 10 are still unanswered: record a competitor's
  invoice as a cost on a subcontracted job, and link an extension invoice to
  the job it extends (so its $75 reaches Profitability).
- Labor per haul is $52 in production cost defaults; Austin said 2–3 hours at
  $26 (≈ $65). Worth confirming.

### 7. Watch list (dates)

- **2026-12-31**: the accepted `braces` advisory expires in
  `scripts/audit-allowlist.json` and CI fails by design. Re-check for a patch.
- Production Supabase still lives in a personal free-tier org with no backups
  (accepted risk 3 in the handoff). Every migration since September has relied
  on manual `pg_dump` backups.

## Plan

**Phase 1 — this PR (no migration):** findings 2, 3, 4, plus the guard test.

**Phase 2 — catch up the confirmations:** the sender works again (finding 1).
Dispatch resends the #1070 confirmation and sends one for #1071 from the job
page. Then, in code: have the maintenance cron retry a failed confirmation for
a job that hasn't happened yet, and show failed sends on the Dashboard, so a
sender outage can't go unnoticed for a week again.

**Phase 3 — the Oct 10 promises:** price on confirmations, cancellation and
day-before reminder emails (one migration, cron-driven), then quotes, then
Profitability charts.

**Phase 4 — ask Austin:** the questions in finding 6.

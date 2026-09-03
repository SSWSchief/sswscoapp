# Billing assumptions

Working assumptions made while Austin's answers are outstanding, so the build
could keep moving. Each one names exactly what to change when the real answer
arrives. Nothing here is a decision — they are all placeholders with a known
cost of reversal.

Asked 2026-09-01, unanswered as of this writing.

---

## Confirmed facts (not assumptions)

Transcribed from the SSWS Binder rate sheet, page 1:

| | 20 Yard | 40 Yard |
|---|---|---|
| Base rental | $400 | $525 |
| Included period | 7 days | 14 days |
| Included weight | 4 tons | 6 tons |
| Additional tonnage | $85/ton | $85/ton |
| Additional days | $25/day | $30/day |
| Delivery / pickup | included | included |
| Fuel / environmental | 5% surcharge | 5% surcharge |

Fees: overweight/overload $85/ton · dry run $125 · relocation/swap $75 ·
prohibited material $250.

---

## Open assumptions

### 1. A swap's container is the one going out

**Assumed:** on a `Swap / Exchange` job, `assigned_dumpster_id` is the fresh can
being delivered, and the can being collected is whatever placement is currently
open at that address.

**Why:** a job carries one container reference and a swap involves two. This is
the ordinary dispatch convention.

**Encoded in:** `supabase/migrations/202609010001_disposal_tickets_and_placements.sql`,
the `Swap / Exchange` branch of `sync_container_placement`.

**To change:** swap the two `dumpster_id` references in that branch. Nothing
else in the model depends on the direction. Requires a
`create or replace function` against the database — the trigger itself is
unaffected.

### 2. The delivery day counts as day one

**Assumed:** a container delivered and collected on the same calendar day is
one billable day, not zero.

**Encoded in:** `src/lib/billing/measures.ts`, `daysOnSite` — the `+ 1`.

**To change:** drop the `+ 1` and update `measures.test.ts`.

### 3. Rental days are counted in company local time

**Assumed:** calendar days in `America/Los_Angeles`, not elapsed hours. A can
dropped 6pm Monday and pulled 8am Tuesday is two days.

**Why:** it is how a paper ticket would be read, and it matches
`company_settings.time_zone`.

**Encoded in:** `src/lib/billing/measures.ts`, `daysOnSite`.

**To change:** the `timeZone` parameter already exists; wire it to
`company_settings.time_zone` rather than defaulting.

### 4. The disposal ticket prompts, it does not gate

**Assumed:** a driver can complete a haul without filing the scale ticket.
Photos still gate completion; the ticket does not.

**Why:** the ticket often is not in the driver's hand at the jobsite, and
blocking completion in the cab produces exactly the workarounds — a guessed
weight, a skipped step — that make billing data untrustworthy. The button stays
available after completion so the ticket can be filed late, and dispatch can
enter it from the office.

**Encoded in:** `src/app/driver/jobs/[id]/page.tsx` — the ticket button renders
for `status === "arrived" || completed`, while `complete()` checks only photos.

**To change:** add a ticket check to `complete()` alongside the photo check.

### 5. Weight is stored in pounds, never tons

**Assumed:** the scale ticket's own figure is authoritative and conversion
happens at the point of use.

**Why:** avoids compounding rounding error into a billed amount.

**Encoded in:** `disposal_tickets.net_weight_lbs`, and `netTons` in
`src/lib/billing/measures.ts`.

**To change:** nothing should need to. This one is safe to keep regardless of
how Austin answers.

---

## Deferred, deliberately not built

These need answers before any code is written, because guessing wrong means
wrong money on a customer's invoice.

- **Fuel surcharge basis** — 5% of the base rental, or of the whole invoice
  including tonnage and days? Build it as a stored basis on the rate card
  (`base_only` / `subtotal`) so it is a data change, not a code change.
- **Per-customer rate cards** — the sheet has Company Name and Valid Through
  fields, implying each GC is quoted separately. Plan for a default card plus
  optional per-customer overrides; if everyone is on the same sheet, overrides
  simply go unused.
- **10 and 30 yard containers** — offered by the app, unpriced on the sheet.
- **Dump & Return** — a service in the app with no price on the sheet.
- **PO numbers** — GC accounts-payable departments commonly reject invoices
  without one. The first release stores and prints a reviewed PO number, but
  does not derive or require one automatically for every customer.
- **Per-haul vs monthly statement billing.**
- **Prepay vs net terms** for residential and one-off commercial.
- **Payment terms** — due on receipt, Net 15, Net 30.
- **Nevada sales tax treatment** — a question for the client's CPA, not for us.

## Verified against production

The placement trigger was exercised end to end on 2026-09-01 inside a rolled
back transaction: delivery opened a span, a swap closed it and opened the next,
a relocation moved the address without breaking the span, and a pick-up closed
it. Two rentals from four jobs, no orphans.

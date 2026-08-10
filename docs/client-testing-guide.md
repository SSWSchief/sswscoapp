# Overwatch — Client Testing Guide

This guide is for the Silver State Waste Solutions team testing Overwatch before
full launch. It explains where to sign in, what to try, what is deliberately not
built yet, and how to report a problem.

## Where to sign in

**https://sswscoapp.vercel.app**

Sign in with the email and password issued to you. There is no public sign-up —
accounts are created by an administrator, who will either email you an
invitation or hand you a temporary password directly.

If you were given a temporary password, sign in with it and then set your own
from **Change Password** — it's in the menu at the bottom of the sidebar on a
computer, and under **Profile** on a phone.

Forgotten your password? If company email sending is switched on, use
**Forgot password?** on the sign-in screen. Otherwise ask an administrator to
issue you a new temporary one.

Overwatch works in any modern browser and installs to a phone's Home Screen.
Drivers should install it: open the site in Safari on iPhone, tap Share, then
**Add to Home Screen**. Driver → Profile has the same instructions.

## What each role sees

You are routed automatically to the right workspace after signing in.

**Administrator** — everything below, plus **Management Overview** (live metrics
and exceptions) and **Settings** (company details, employee access, SOP and
pre-trip publishing, training data).

**Dispatcher** — Operations Overview, Jobs, Locations, Messages, Customers,
Trucks, Dumpsters, Employees, Time Clock, Absence, Invoices, and Reports. An
administrator can switch individual modules on or off per employee, so two
dispatchers may not see the same menu.

**Driver** — My Jobs, Time, Pre-Trip, Messages, SOPs, and Profile. Drivers see
only their own assigned work. They cannot see other drivers' jobs, photos, or
notes; this is enforced by the database, not just the screens.

## Training records vs. real records

Administrators can create a small practice dataset from **Settings → Training
Data**. It creates exactly five linked records — one customer, one truck, one
dumpster, one pending unassigned job, and one zero-dollar draft invoice.

**Every one of them is labeled `TRAINING`.** Anything with that label is safe to
experiment with. Anything without it is a real record.

To remove the practice data, go back to **Settings → Training Data**, choose
**Remove Training Data**, type `DELETE TRAINING DATA`, and confirm. All five
records are deleted together and the action is written to audit history. It
creates no logins, messages, time records, photos, SOPs, or checklists, so
removing it cannot disturb anything else.

## What to try

Work through these end to end and note anything confusing or wrong.

**Dispatcher**
1. Create a customer, a truck, and a dumpster.
2. Create a job and assign a driver, truck, and dumpster to it.
3. Watch the job change status as the driver works it — no page refresh needed.
4. Cancel a job and record a dry run, and confirm the assets are released.
5. Review a driver's time entry and approve or deny a correction request.
6. Download a report as CSV from **Reports**.

**Driver (on a real phone)**
1. Open **My Jobs** and confirm only your work appears.
2. Take a job en route, mark arrived, then complete it with a photo.
3. Add a note to a job.
4. Clock in, take a break, clock back on, and clock out.
5. Complete a pre-trip inspection, including one with a failure.
6. Acknowledge an SOP.
7. Turn airplane mode on mid-task and watch how the app behaves, then reconnect.

**Administrator**
1. Add an employee, set their role and module access, and give them access
   (temporary password or emailed invitation).
2. Turn one module off for a dispatcher and confirm it disappears for them.
3. Review Management Overview metrics against what you know is true.
4. Change a company setting and confirm it is recorded.

## Known limits during testing

These are expected. Please do not report them as bugs.

- **Dispatch alerts for unassigned jobs run once a day, not every 15 minutes.**
  The faster cadence needs a hosting plan upgrade and is being scheduled.
- **Administrator sign-in is password-only.** Two-factor is intentionally turned
  off for now. Use a strong, unique password and do not share it.
- **Time totals are exact and raw.** There is no payroll math, no overtime rules,
  no rounding, and no automatic deductions of any kind.
- **Invoices are records only.** Overwatch does not take payments.
- **Locations are the last reported position** entered manually or from AirTags.
  There is no live GPS trail.

## Not in this release

Deliberately out of scope, by agreement: payment processing, payroll, route
optimization, a customer-facing portal, live GPS tracking, automated fleet
maintenance, and AI dispatching.

## Reporting a problem

Send the support owner:

1. **Who you were signed in as** — the role, not the password.
2. **What screen you were on** and what you were trying to do.
3. **Roughly what time** it happened.
4. **The Reference code**, if one appeared. When an action fails, the message
   ends with something like `(Reference sfo1::abc123-...)`. Copy that whole code
   — it points straight at the matching server log.

If the screen shows **Something Went Wrong** instead, there is no Reference code.
Just describe what you were doing right before it appeared.

**Never put passwords, customer or employee personal details, phone numbers, job
notes, or photos into a support message.** Describe the record instead — "the
job for the Rainbow Blvd customer" is enough to find it.

## Before real launch

When testing finishes, the team will remove the training dataset and clear any
practice records you entered, so the live system starts clean. Please keep a note
of anything you created that should be kept.

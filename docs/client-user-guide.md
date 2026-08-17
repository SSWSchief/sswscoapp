# Overwatch — How to use the app

This is the everyday guide to Overwatch, the operations app for Silver State
Waste Solutions. It covers signing in, the driver app on a phone, the dispatch
screens on a computer, and the administrator settings.

Every screenshot here was taken from practice records. Anything labeled
`TRAINING` is safe to experiment with; anything without that label is real.

If you only do one job, read that section. Nobody needs to read all of it.

## Signing in

Overwatch lives at **https://sswscoapp.vercel.app**. It works in any modern
browser on a phone, tablet, or computer.

There is no sign-up. An administrator creates your account and hands you a
**temporary password** in person. Sign in with your work email and that
password.

![The sign-in screen on a computer.](images/guide/01-sign-in-desktop.png)

On a phone it is the same screen, sized for one hand.

![The sign-in screen on a phone.](images/guide/02-sign-in-phone.png)

### Set your own password straight away

Your temporary password is meant to be replaced. Open **Change Password** —
it's at the bottom of the sidebar on a computer, and under **Profile** on a
phone — and choose your own.

![Setting a new password. It must be at least 12 characters with an uppercase letter, a lowercase letter, and a number.](images/guide/03-change-password.png)

### If you forget your password

Ask an administrator for a new temporary one.

Overwatch does not send email. There is no "forgot password" link, no reset
message, and no invitation email. If you are waiting for an email from
Overwatch, you are waiting for something that isn't coming — ask a person
instead.

### Where you land

You are sent to the right place automatically. Drivers land on **My Jobs**,
dispatchers on **Operations Overview**, administrators on **Management
Overview**.

If your account can open more than one workspace, the menu starts with a
**Portals** list and you can move between them whenever you like.
Administrators have all three. Most people have one, and then the list doesn't
appear at all.

![The Portals list at the top of the sidebar, with Management, Dispatch, and Driver.](images/guide/04-portals-sidebar.png)

One thing to know if you're an office account looking at the Driver portal:
**My Jobs will be empty.** Work is only ever dispatched to driver accounts. The
portal is there so you can see exactly what a driver sees when you're training
someone.

## For drivers

This section is written for a phone, because that is where you'll use it.

### Put it on your Home Screen

Open the site in Safari, tap **Share**, then **Add to Home Screen**. It then
opens like any other app, full screen, without the browser bars. The same
instructions are on your **Profile** screen.

### My Jobs

**My Jobs** shows only your work. Other drivers' jobs, photos, and notes are
not visible to you, and yours are not visible to them.

**Today** and **Upcoming** are the two tabs. Each card shows the time, the
customer, the address, the truck and dumpster, and the current status.

- **Navigate** opens the address in your phone's maps app.
- **Open Job** opens the full job.

![My Jobs, showing today's assigned work.](images/guide/05-driver-my-jobs.png)

### Working a job

Open the job and you'll see the customer, the address, **Navigate** and **Call
Customer** buttons, and a **Job steps** bar tracking where you are: Start,
Arrive, Photo, Complete.

![A job before it's started. The action bar at the bottom shows Start Route.](images/guide/06-driver-job-details.png)

**1. Start Route** when you set off. Dispatch sees the change immediately.

![After Start Route, the job is En Route and the next button is Arrived.](images/guide/07-driver-job-en-route.png)

**2. Arrived** when you get there. The action bar then offers everything you
need on site.

![On site. Take Photo, Add Note, Dry Run, and Complete Job.](images/guide/08-driver-job-arrived.png)

**3. Take a photo.** At least one photo is required before you can complete a
job — the Complete button stays greyed out and reads *Add a photo to complete*
until you add one. Use **Take Photo** for the camera, or the **+** tile in the
Photos panel to pick one you already took. JPEG, PNG, WebP, and HEIC up to
10 MB each.

![With a photo attached, Complete Job is available.](images/guide/09-driver-job-photo.png)

**4. Complete Job.** You'll be asked to confirm, because it can't be undone
from your phone.

### Adding a note

**Add Note** records anything the office should know — where you left the
container, a gate code, a problem on site. Type it and tap **Save Note**.

![Adding a note to a job.](images/guide/10-driver-job-note.png)

### When you can't do the job

If something on site stops you, use **Dry Run** instead of completing. Say what
prevented service, and dispatch is told straight away.

![Recording a dry run. The reason is required.](images/guide/11-driver-dry-run.png)

### Time

The menu calls it **Time**; the screen itself is headed Time Clock.

**Clock In** when you start. While you're on the clock you'll see a running
timer and your entries for the day.

- **Start Break** and **End Break** — you can take as many breaks as you need,
  as long as each one ends.
- **Clock Out** at the end of the day. You'll be asked to confirm, and told how
  long you worked.

![The time clock, clocked in, with today's entries below.](images/guide/12-driver-time-clock.png)

Your hours are exact. There is no rounding, no overtime calculation, and
nothing is deducted automatically. Dispatch reviews them.

If you clocked in late, forgot to clock out, or need time off, use **Change
Time** or **Request PTO**. Your request goes to dispatch to approve or deny,
and you'll see its status on this screen.

![Requesting a time change.](images/guide/13-driver-time-request.png)

### Pre-trip inspection

**Pre-Trip** is the daily truck inspection. Pick your truck, enter the current
mileage, mark every item **Pass** or **Fail**, type your name as a signature,
and submit.

Nothing is optional — the form won't submit until every item has an answer.

If you mark anything as failed, dispatch is alerted automatically. Recording a
failure does not stop you being assigned that truck; it makes sure the office
knows.

![The pre-trip checklist.](images/guide/14-driver-pre-trip.png)

### SOPs

**SOPs** holds the company's standard operating procedures. When a new one is
published, it shows a **Review** badge — read it and tap **I Have Read This
SOP**. The badge turns to **Reviewed**, and the office can see who has
acknowledged the current version.

![The SOP library.](images/guide/15-driver-sops.png)

### Messages

**Messages** is internal — announcements to everyone and direct messages with
the office.

![Driver messages.](images/guide/16-driver-messages.png)

### Profile

**Profile** has your details, your assigned truck, the Home Screen install
instructions, **Night Mode** for driving after dark, **Change Password**, and
**Log Out**.

![The driver profile screen.](images/guide/17-driver-profile.png)

### If you lose signal

A yellow bar appears across the top: *You're offline — reconnect before
submitting changes.*

What's already on screen stays readable, but nothing you do will save until you
have signal again. Don't complete a job or clock out while that bar is showing
— reconnect first, then do it.

## For dispatchers

This section is written for a computer, though every screen works on a phone
too.

Which menu items you see depends on what an administrator has switched on for
you, so two dispatchers may not have identical menus.

### Operations Overview

The daily starting point. **Needs Attention** across the top counts the things
waiting on somebody — unassigned jobs, active jobs, time requests, failed
pre-trips, open invoices — and each one is a link straight to the list.

Below that: today's job counts by status, today's jobs, an at-a-glance count of
drivers, trucks and dumpsters, and recent activity.

![Operations Overview.](images/guide/18-dispatch-overview.png)

### Jobs

Every job, searchable by job number, customer, or address, filterable by status,
and sortable by time, customer, or status.

![The jobs list.](images/guide/19-dispatch-jobs.png)

**New Job** opens the form. Customer and address, service type and dumpster
size, the scheduled date, and the driver, truck, and dumpster.

You can leave a job unassigned and come back to it — it will show in the
unassigned queue on the overview. Only accounts with driver access appear in
the **Assign Driver** list.

![Creating a job.](images/guide/20-dispatch-new-job.png)

### Following a job

Open any job to see its information, its assignments, and its status timeline.
Status updates arrive as the driver works — you don't need to refresh. The job
below is mid-route: the driver has already marked it arrived.

The **Acknowledgement** line tells you whether the assigned driver has seen the
assignment yet. Photos, activity, and notes fill in as the job proceeds.

![A job's detail screen.](images/guide/21-dispatch-job-details.png)

Two things you can do that a driver can't:

- **Mark Complete** on a job without a photo. Overwatch will ask you to give a
  reason, and records it.
- **Cancel** the job. A reason is required, and the truck and dumpster are
  released back to the pool.

![Cancelling a job. The reason is recorded permanently.](images/guide/22-dispatch-cancel-job.png)

### Customers

The customer list, with contact details and their job history.

![The customer list.](images/guide/23-dispatch-customers.png)

**Add Customer** takes a name, address, phone, email, and an optional group.

![Adding a customer.](images/guide/24-dispatch-add-customer.png)

### Trucks and dumpsters

**Trucks** holds each truck's number, type, status, plate, assigned driver, and
notes.

![The truck list.](images/guide/25-dispatch-trucks.png)

**Dumpsters** holds the container ID, size, type, status, AirTag ID, and
current location.

![The dumpster list.](images/guide/26-dispatch-dumpsters.png)

### Locations

**Locations** is every truck and dumpster with its last known position, and
**Open in Maps** for anything with an address.

This is the last reported position — operational or entered by hand, plus AirTag
identifiers kept as records. It is not live GPS and it is not Apple's Find My.

![Locations and AirTags.](images/guide/27-dispatch-locations.png)

### Time Clock

Today's entries for every driver — clock in, breaks, clock out, hours, and
whether they're currently on the clock. Exact times, no payroll rounding.

Below the table are the **Time Change / PTO Requests** drivers have submitted.
**Approve** or **Deny** each one; the driver sees the outcome on their phone.

![Reviewing driver time.](images/guide/28-dispatch-time-clock.png)

### Absence

PTO balances and hours for the week per driver, scheduling accommodations, and
the same time and PTO requests in calendar form.

![The absence calendar.](images/guide/29-dispatch-absence.png)

### Invoices

Invoice records — number, customer, amount, status, and due date — plus total
receivables and a count of open invoices. **New Invoice** creates one, and
**Export CSV** downloads the list.

Overwatch records invoices. It does not send them and it does not take
payments.

![Invoice records.](images/guide/30-dispatch-invoices.png)

### Reports

Pick a date range, then download any of four CSV exports: **Operations**,
**Employee Time**, **Asset Utilization**, and **Invoice Records**. The counts
above the buttons update with the range so you can check it before downloading.

![Reports and exports.](images/guide/31-dispatch-reports.png)

### Messages

Announcements to the whole team and direct messages with drivers. **Seen by…**
under a message you sent shows who has read it.

![Dispatch messages.](images/guide/32-dispatch-messages.png)

## For administrators

Administrators can do everything above, plus the two screens below.

### Management Overview

Live metrics — jobs today, active jobs, receivables, available assets — and an
**Exceptions** list: unassigned jobs, pending time requests, failed pre-trips,
inactive employees. Every number is a link to the underlying records.

![Management Overview.](images/guide/33-admin-management.png)

### Employees

The staff list, with each person's role, access, and status.

![The employee list.](images/guide/34-admin-employees.png)

**Add Employee** takes an employee ID, name, email, phone, operational role,
and access role. Under **How they get in**, choose **Give them a temporary
password** — that's the one that works today. It sends no email; it shows a
password once, on screen, for you to hand over.

The other option, *Email them an invitation*, needs company email sending to be
configured, which it isn't. Its link is never delivered.

![Adding an employee.](images/guide/35-admin-add-employee.png)

**Write the temporary password down before you close the screen.** It is shown
once and can't be retrieved. If it's lost, issue a new one from the employee's
page.

### Access control

Open an employee to set their **Role Preset** — Admin, Dispatcher, or Driver —
and to switch individual modules on or off. **Effective Access Preview** on the
right lists exactly what that person will and won't see. Changes take effect
immediately.

This page is also where you **Issue Temporary Password** if someone is locked
out, and where you deactivate someone who has left.

![Employee access control.](images/guide/36-admin-employee-access.png)

Two accounts — Austin Marshall and the support administrator — are permanently
protected. They can't be deactivated, downgraded, or have permissions removed
from the app. This is deliberate: it stops a mistake or a single bad session
locking every administrator out. The screen will appear to accept such a change
and it will be quietly undone.

### Settings

**Settings** is administrator-only and has a tab for each area.

**Company** holds the company name, address, phone, email, time zone, and date
format.

![Company settings.](images/guide/37-admin-settings-company.png)

**App Defaults** controls how long messages are kept and what invoice numbers
start with.

**Driver Checklist** publishes the pre-trip inspection form. Type one item per
line and publish; drivers get the new version immediately. Publishing a new
version retires the old one.

![Publishing the pre-trip checklist.](images/guide/38-admin-settings-checklist.png)

**SOP Library** publishes procedures the same way. Tick *Require drivers to
acknowledge this SOP*, and the panel at the bottom tells you who has
acknowledged it and who still owes you.

Publish only approved company content here. Whatever is on this screen is what
drivers are told is company policy.

![Publishing an SOP.](images/guide/39-admin-settings-sops.png)

**Users & Roles** lists active administrators. **Pricing** holds the price
list.

**Training Data** creates a practice set: one customer, one truck, one
dumpster, one pending unassigned job, and one zero-dollar draft invoice. All
five are labeled `TRAINING`. It creates no logins, messages, time records,
photos, SOPs, or checklists.

To remove it, choose **Remove Training Data**, type `DELETE TRAINING DATA`, and
confirm. All five go together, and the removal is recorded in audit history.

![Training data.](images/guide/40-admin-settings-training.png)

## When something goes wrong

If an action fails, the message ends with a reference code that looks like
`(Reference sfo1::abc123-...)`. **Copy the whole code** — it points straight at
the matching server log.

Send the support owner:

1. **Who you were signed in as** — the role, not the password.
2. **What screen you were on** and what you were trying to do.
3. **Roughly what time** it happened.
4. **The Reference code**, if there was one.

If you got a **Something Went Wrong** screen instead, there's no reference code.
Just describe what you were doing right before it appeared.

> Never put passwords, customer or employee personal details, phone numbers, job
> notes, or photos in a support message. Describe the record instead — "the job
> for the Rainbow Blvd customer" is enough for anyone to find it.

## What Overwatch does not do

None of these are missing by accident. They were agreed to be out of scope, and
nothing in the app will do them:

- **No payments.** Invoices are records only.
- **No payroll.** Hours are exact and raw — no overtime rules, no rounding, no
  deductions.
- **No email.** No invitations, no password resets, no notifications by mail.
- **No live GPS.** Locations are last reported, not tracked.
- **No route optimization** and no automatic dispatching.
- **No customer portal.** Customers have no login.
- **No automated fleet maintenance.**

Two more worth knowing:

- **Alerts for unassigned jobs run once a day**, not every 15 minutes. The
  faster schedule needs a hosting upgrade.
- **Administrator sign-in is password-only.** Two-factor is intentionally off.
  Use a strong, unique password and don't share it.

---

Administrators setting the system up for the first time should read
[docs/client-handoff.md](client-handoff.md), which covers launch configuration,
protected accounts, and the accepted risks.

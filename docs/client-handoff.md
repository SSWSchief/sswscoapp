# Client Handoff and Full-Launch Guide

Use this guide only after the exact release commit passes blank-database CI and
authenticated staging acceptance. Production starts with the two approved
administrators, Company Announcements, Dispatch, and at most one controlled
training dataset. Automated E2E identities never enter production.

## State at handoff

Read this section first; it is what is true on the day the system changes hands.

**Working.** Sign-in, all three portals, jobs and dispatch, time clock, pre-trip,
SOPs, messages, invoices, reports, exports, and audit history. Employees can be
onboarded with an administrator-issued temporary password or an emailed
invitation — see the email delivery note below.

**Update — September 4, 2026.** Email delivery is no longer deferred; see below.
Invoicing has since been built and proven end to end on staging, and is listed
here because production sending stays off by design until the live-mode
sequence is signed off. The rest remain switched off by agreement, not
oversight:

| Deferred | Consequence today | To enable |
| --- | --- | --- |
| Administrator MFA | Administrator accounts are password-only. | A deliberate change with factor enrolment rehearsed first — see the accepted risks. |
| 15-minute maintenance cron | Unassigned-job alerts run once daily instead of every 15 minutes. | A Vercel plan supporting sub-daily cron, or an external scheduler calling `/api/cron/maintenance` with `CRON_SECRET`. |
| Sending invoices from production | The office can enter customers and jobs and build invoice drafts, but production will not transmit one to a customer. Drafting, numbering and the double-billing guard all work; the send path is proven on staging against Stripe test mode. | Enter the company invoice terms, then the live-mode sequence in `docs/manual-launch-checklist.md` §9 — CPA tax determination, live key and webhook, one controlled low-value live invoice — and finally `STRIPE_INVOICING_ENABLED=true`. See Invoicing below. |

**Email delivery — live since August 16, 2026, through Resend.** Onboarding no
longer runs exclusively on administrator-issued temporary passwords; emailed
invitations and self-service password reset work. That path was not exercised
against a real employee until August 17, 2026, when a gap was found and closed:
two buttons that emailed a reset link (`/dispatcher/employees/[id]` and
Settings → Users & Roles) had never been wired to check whether delivery was
configured, so before this date they reported success while sending nothing
whenever it was not. See the appendix for the current configuration and what
that incident actually turned out to be.

**Accepted risks.** Each was reviewed and accepted; reconfirm them at each
release.

1. *Password-only administrator access.* MFA is not enforced. Compensating
   controls: strong unique passwords, short administrator sessions, Auth and
   application rate limits, immutable owner profiles, active-profile
   enforcement, and audited administrator actions. See the two dashboard
   settings below — the first compensating control is not currently enforced.
2. *Permanent support administrator.* See "Protected administrator profiles"
   below — this one has consequences worth understanding before signing.
3. *No database backups.* Accepted September 4, 2026. The Supabase project is on
   the free tier, which provides none, so there is no point-in-time recovery and
   nothing to restore from. Stated plainly because the system is about to hold
   billing records: a mistaken bulk delete, a bad migration, or a project-level
   failure would be unrecoverable, and the quarterly restore drill that
   `docs/deployment-runbook.md` requires cannot be performed at all. Checklist
   §5 stays unsigned. Compensating controls are thin by nature — the destructive
   paths that exist in the application are audited and confirmation-gated, and
   `TRUNCATE` has been revoked from the roles the browser runs as. Reversible at
   any time by upgrading to a paid plan, which is the decision this risk is
   standing in for.

**Two dashboard settings worth closing.** Neither is exploitable today and
neither blocks handover, but both are one toggle each and both contradict what
this documentation claims is in place. Verified against production on
August 13, 2026.

*Password strength — mostly closed in the application, one toggle left.* The
password rule now lives in `src/lib/password-policy.ts` and is applied wherever
this application sets or accepts a password: at least 12 characters with an
uppercase letter, a lowercase letter, and a number. Previously only length was
checked, so `aaaaaaaaaaaa` was accepted.

The same change fixed a latent fault in the temporary-password generator.
Removing the glyphs people misread leaves only six digits among forty-nine
characters, so a free draw of sixteen produced no digit roughly **one time in
eight**. Nothing failed while the platform accepted weak passwords — but the day
anyone enabled the documented complexity requirement, about an eighth of
employee onboardings would have started failing with nothing obvious to blame.
The generator now guarantees one character of each class and verifies its own
output against the policy.

What remains is the platform floor: Supabase itself still accepts six
characters, so a request sent straight to the API, bypassing this application,
is not subject to the rule above. That only lets someone weaken their own
account, but it is worth closing as defence in depth — Authentication → Sign In
/ Providers → set minimum password length to 12 and require lower/upper/digits.
Note `supabase/config.toml` already specifies exactly this; that file governs
only local development and never touches a hosted project, which is how the
mismatch survived unnoticed.

*Public signup is enabled.* `disable_signup` reads `false` on production, so the
signup endpoint accepts requests even though the application exposes no sign-up
screen. This matters because of `link_auth_user`, which attaches any newly
created account to an employee profile whose email matches and which has no
account yet:

```sql
update public.users set auth_user_id = new.id
where lower(email) = lower(new.email) and auth_user_id is null;
```

Someone who knew an employee's address and signed up with it before that
employee received an account would inherit the profile, and with it that
person's role. It is not reachable today because new signups require email
confirmation and no mail can be delivered — but that protection disappears the
moment SMTP is switched on. **If you ever follow the email appendix, disable
signup first.** Fix in Authentication → Sign In / Providers → disable "Allow new
users to sign up".

**Reserved development accounts** used during build
(`tehronporter+ssws.dispatch@`, `tehronporter+ssws.driver@`) have had their
sign-in deleted and their profiles deactivated. Their profile rows remain
because audit history references them and that history is immutable by design.
They cannot sign in and will not appear as active employees.

## Administrator setup order

1. Confirm the company address, phone, email, Pacific time zone, invoice prefix,
   message retention, and approved Auth/session policy.
2. Confirm Austin Marshall and Tehron Porter can sign in with unique strong
   passwords. Tehron is the approved indefinite support administrator. Add and
   verify a second client-controlled administrator before staff rollout.
3. Enter real employees and verify role, access preset, individual overrides,
   phone, and active status before giving anyone access. Either onboarding path
   works now that email delivery is connected (see the appendix): issue a
   temporary password directly — shown once for you to hand over, sends no
   email — or email an invitation. If you use the temporary-password path,
   hand the password over; an account with no password ever delivered is
   indistinguishable, from the system's point of view, from one waiting on
   email that was never sent. Administrators can issue a replacement from the
   employee page if one is lost either way.
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

The training invoice is a legacy containment fixture and cannot be sent. Stripe
acceptance invoices must be created from completed staging jobs through the
invoice builder with positive, reviewed line items.

## Staff launch

- Issue temporary passwords only after each employee profile has been reviewed.
- Have every user complete sign-in and password setup during the approved
  onboarding window. Do not share passwords or reuse staging credentials.
- Hand each temporary password over in person or by a channel the employee
  already controls. It is shown once and cannot be retrieved afterwards; issue a
  replacement from the employee page instead of trying to recover it.
- Administrators verify Settings, Employees, Management, exports, and audit
  access. Dispatchers verify customers, assets, jobs, assignments, messages,
  time review, and reports. Drivers verify assigned work, photos, notes, time,
  messages, pre-trip, SOPs, profile, offline/reconnect, and sign-out.
- The navigation opens with a Portals list naming every portal the account can
  open — Management, Dispatch, Driver — in the office sidebar, the office mobile
  drawer, and the driver menu. Administrators hold all three. A dispatcher sees
  only Dispatch until an administrator grants Driver My Jobs from Employees, and
  drivers see no list at all, since a single portal has nothing to switch to.
- Jobs can still only be assigned to driver-access accounts, so My Jobs stays
  empty for an office account opening the driver portal. Anyone who needs work
  dispatched under their own name needs a driver-access profile.
- Reconcile the first live jobs and time events against the previous process.
  Keep the prior Vercel deployment available throughout the rollback window.

## Invoicing

Invoicing is built, deployed and proven end to end on staging against Stripe
test mode — a draft raised in the app reaches a real hosted payment page. Two
things stand between that and the office billing customers, and only the
company can supply them: the invoice terms and the rate card.

**Production cannot send yet, deliberately.** `STRIPE_INVOICING_ENABLED` is
`false` in Vercel production, so the office can enter customers, complete jobs
and build drafts today with no risk of a half-finished invoice reaching a
customer. Sending is exercised on staging until the live-mode steps in
`docs/manual-launch-checklist.md` §9 are signed off.

### Before anyone can send: the invoice terms

`company_settings.invoice_terms` is **empty**, and every send is refused with
"Company invoice terms are required before sending" before Stripe is contacted.
An administrator enters it at **Settings → Company → Invoice terms**. It prints
as the footer of every Stripe invoice, so the wording is the company's own —
5000 characters, enforced in the form and again in the database. From the
binder it should cover the rental period and included tonnage per size, the
additional-day and additional-tonnage rates, the fuel/environmental surcharge,
the prohibited-materials list and its $250 fee, and the dry-run fee.

The rate card is the same kind of item: prices are the company's, and the
mapping onto service types wants Austin's eye before it is seeded.

### Who can raise an invoice

Administrators hold Invoices by role. Dispatchers do not by default, but the
permission is grantable per person — **Employees & access → the employee →
Finance & Reporting → Invoices**. That is a per-employee override, not a change
to what "dispatcher" means, so it stays deliberate and is visible on the
employee's own record.

### Raising one

1. **Dispatch → Invoices → New invoice.**
2. Choose the customer. The completed jobs available to bill appear once the
   customer is chosen; a job already billed does not reappear, which is what
   stops the same work being invoiced twice.
3. Select the completed work, then enter the line items. The total is the sum of
   the lines — it is never typed directly, and a zero-amount line is rejected.
4. **Save draft.** The invoice number is assigned at that moment by a
   transactional counter, not before; the field reads "Assigned when saved"
   until then. Numbers are gap-free and never collide, even if two people save
   at the same instant.
5. Read the recipient review block before sending, and see below.

### What a send checks

A send is refused, with the reason shown, unless all of the following hold. All
of it is checked locally first, so a bad invoice never reaches Stripe:

- the invoice is still a draft, with at least one positive line, and its total
  matches its lines;
- every job on it is still complete, still belongs to that customer, and has not
  been deleted;
- the billing contact has a name and a valid email address;
- the billing address is complete — **line 1, city, state and postal code**.
  This is the one that will bite during data entry: a customer entered with only
  a street line looks fine everywhere else in the app and fails only at the
  point of sending, one customer at a time. Enter full addresses from the start;
- the invoice number fits Stripe's 26-character limit;
- the company invoice terms are set;
- in live mode only, the tax policy has been approved.

### After it is sent

A sent invoice is **read-only**. That is the design, not a limitation — it
matches what the customer has already received. The row then offers:

- **Payment page** — the hosted Stripe page the customer pays on.
- **Revise** — the way to correct a sent invoice. It supersedes the original in
  Stripe rather than editing it, so both the customer and the ledger keep an
  honest record of what changed.
- **Void** — cancels it and releases its jobs to be billed again.
- **Write off** — marks it uncollectible without pretending it was paid.
- **Refresh Stripe** — pulls the current state from Stripe by hand. Routine
  payment updates arrive on their own through the webhook; this is for when you
  want to confirm rather than wait.

Payments, failures and ACH "processing" all arrive by webhook and move the
invoice on their own. Nobody needs to mark an invoice paid.

### Training the office

Walk through it on staging, where sending is on: draft → check the recipient
review block → send once → open the payment page → pay with a Stripe test card
→ watch it reach **paid** without anyone touching it. Then show Revise, and say
plainly that corrections go through Revise rather than through editing or a
second send. A second send is not offered for an invoice Stripe already holds,
and the acceptance suite asserts that.

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

## Protected administrator profiles

Two email addresses are pinned in the database as permanently active
administrators:

- `amarshall@sswsco.com` — Austin Marshall, client owner
- `tehronporter@gmail.com` — Tehron Porter, support administrator

A database trigger (`enforce_owner_profile_access`, migration
`202608060009_owner_profiles.sql`) forces both to `role=management`,
`access_role=admin`, `status=active`, and empty permission overrides on every
write. Understand what this means before signing off:

- Neither account can be deactivated, downgraded, deleted, or have permissions
  reduced **through the application**. The interface will appear to accept such
  a change and the trigger will silently restore it.
- Their email addresses cannot be changed; the trigger raises an error.
- This is intentional. It prevents a misconfiguration or a single hostile
  session from locking every administrator out of the system.
- **Removing an address from this list requires a new database migration and a
  deployment.** It is not a setting. If the support relationship ends, that
  migration is the mechanism, and it should be treated as a normal change with
  its own review.

The client owner accepts, by signing this handoff, that the support
administrator retains access to production data until such a migration is
applied.

## Appendix — email delivery (live, connected August 16, 2026)

This originally planned to route mail through the company's existing
Microsoft 365 tenant. It shipped through **Resend** instead — that needed a
new vendor after all, but avoided touching Microsoft 365's SMTP AUTH setting,
which is disabled by default on modern tenants and would have needed IT help
to change. What follows documents what is actually configured, not the
original plan; the steps still generalize to any future provider change.

**Current configuration**

- Resend account `sswsco`, domain `sswsco.com` — added and verified
  August 16, 2026. Domain identity (DKIM) is published at
  `resend._domainkey.sswsco.com`, on the apex domain. The sending SPF/MX pair
  lives on Resend's own `send.sswsco.com` subdomain, not on `sswsco.com`'s own
  SPF record — this is Resend's standard isolation pattern, added
  automatically when the domain was added, and it does not touch or risk the
  company's existing Microsoft 365 / Proofpoint mail flow. `dig MX sswsco.com`
  should still return the `ppe-hosted.com` (Proofpoint) hosts; if it ever
  doesn't, something touched the wrong record.
- Supabase → Authentication → SMTP Settings: custom SMTP via
  `smtp.resend.com`, sender `notifications@sswsco.com`.
- Invite user and Reset Password templates use the **stock
  `{{ .ConfirmationURL }}`** form. They were briefly hand-edited to a
  `{{ .SiteURL }}` + `{{ .TokenHash }}` form; that is what broke onboarding for
  ten days and it was reverted on August 21, 2026. Step 5 explains why.
  **Confirm sign up also uses the default** — harmless only because public
  signup is disabled (reconfirm that toggle before ever changing this).
- `NEXT_PUBLIC_APP_URL=https://sswscoapp.vercel.app` and
  `NEXT_PUBLIC_EMAIL_DELIVERY_ENABLED=true` in Vercel production.

**Push notifications (VAPID).** Separate from email, and easy to miss: message
push needs three variables in Vercel production, and without them the feature
is inert. Generate the pair once with `npx web-push generate-vapid-keys`, then
set `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, and `VAPID_SUBJECT`
(a `mailto:` address) and **redeploy** — the public key is inlined into the
browser bundle at build time, so adding it without rebuilding changes nothing.
Verify from outside with `curl -s https://sswscoapp.vercel.app/api/health`,
which reports `push.configured` alongside each half of the pair; the values
themselves are never returned. Two platform facts worth stating plainly to
anyone testing it: on iPhone, web push only works once the site is **added to
the Home Screen** (a Safari tab can never receive it), and push is delivered
only to *other* people in the conversation — messaging yourself to test will
always look like a failure.
- Verified end to end on August 21, 2026: a real reset delivered to a Gmail
  inbox, link clicked, session established, "Set new password" reached.

**What actually went wrong on day one, for the record.** An employee
(Matthew Hicks) was reported as never receiving an email. Resend's own send
log showed the true cause: nothing had ever been sent to him — his account
already existed from an earlier temporary-password creation, and no one had
handed him the password. Separately, and worth fixing regardless of that
specific case, two buttons that trigger a reset email (`/dispatcher/employees/
[id]` and Settings → Users & Roles) had no check for whether delivery was
configured at all, so before this fix they would have reported success while
silently sending nothing on any deployment where the flag above is `false`.
Both now hide behind it, matching how the sign-in page's reset link already
behaved.

**If this ever needs to be redone** — a new domain, a new provider, or a
second look because something broke:

0. **Disable public signup first**, if it is not already. Authentication →
   Sign In / Providers → turn off "Allow new users to sign up". Until email
   exists, an unconfirmed self-signup cannot sign in; once mail is delivered
   it can, and `link_auth_user` would attach it to any employee profile with a
   matching address that has no account yet. Doing this after enabling SMTP
   leaves a window open.
1. Add the sending domain in the provider's dashboard and verify its DNS.
   Prefer a provider that isolates its records on their own subdomain rather
   than merging into the company's existing SPF/DMARC on the apex — Resend
   does this automatically; not every provider does, and a badly merged SPF
   record can break the company's real mail, not just the new integration.
2. In Supabase → Project Settings → Authentication → SMTP Settings, enable
   custom SMTP with the provider's host and credentials.
3. Set the sender to a real monitored address on `sswsco.com`, and confirm the
   provider's DKIM record verifies. `sswsco.com` publishes `p=quarantine`, so
   misaligned mail is quarantined rather than delivered.
4. **Set `NEXT_PUBLIC_APP_URL` in Vercel** to the public address of the
   application — today `https://sswscoapp.vercel.app`, or the custom domain if
   one is ever added — and redeploy. This is the single setting that decides
   where an emailed link sends someone.

   It exists because the alternative kept failing. Supabase decides a link's
   destination from the `redirect_to` the application supplies, and falls back
   to the project's **Site URL** whenever there is none. The application used to
   supply none for invitations, so the Site URL — a dashboard field, edited by
   hand, in a different product — was the only thing pointing employees at the
   app. It drifted twice. The second time it pointed at
   `https://sswscoapp-silver-state-waste-solutions.vercel.app`, the team-scoped
   Vercel alias, which Deployment Protection answers with a Vercel login page:
   every new hire who clicked "accept your invitation" was asked to sign up for
   a Vercel account. The application now supplies `redirect_to` on every link it
   sends, from this variable.

   Confirm it took, from anywhere:
   ```
   curl -s https://sswscoapp.vercel.app/api/health
   ```
   `emailLinks.appUrl` must be the public address and `emailLinks.source` should
   read `configured`. `vercel` means the variable is unset and Vercel's own
   production domain is being used — correct today, but not pinned by anything.

5. **Leave the two email templates alone.** Authentication → Emails: the stock
   *Invite user* and *Reset Password* templates both use
   `{{ .ConfirmationURL }}`, and that works end to end.

   Earlier revisions of this document asked for hand-edited templates built on
   `{{ .SiteURL }}` and `{{ .TokenHash }}`. Do not use them. `{{ .SiteURL }}`
   interpolates a dashboard field that the Vercel–Supabase integration rewrites
   on every deployment, so those templates reintroduce the exact failure they
   were meant to avoid. The reason they existed was real —
   `{{ .ConfirmationURL }}` returns its tokens in the URL *fragment*, which
   browsers never send to a server, so `/auth/confirm` could not redeem them —
   but the application handles that case in the browser now, so the stock
   templates are both correct and nothing to maintain.

6. Verify the whole path in one command:
   ```
   npm run auth:check-redirect -- --email=<a reserved account>
   ```
   Never point this at a real employee address. It generates a link and sends
   nothing. It checks three things, and an earlier version that checked only
   the first reported PASS while every invitation was dead-ending:

   - a requested redirect survives the project's allowlist,
   - the Site URL a link falls back to is the application, not an alias,
   - neither address is behind Vercel Deployment Protection.

   The check reads `.env.local`, which points at **staging**, so it verifies
   staging by default. To check production, supply its credentials explicitly
   (environment variables take precedence over the file):
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://<prod-ref>.supabase.co \
   SUPABASE_SECRET_KEY=<prod secret> \
   npm run auth:check-redirect -- --email=<a reserved account>
   ```
   Take the secret key from the Supabase dashboard. Vercel marks it Sensitive,
   so `vercel env pull` returns it empty — that is intended, not a fault.
   Treat that key as sensitive once it has been typed anywhere: clear terminal
   scrollback afterward, and rotate it in Supabase → Project Settings → API if
   it is ever visible in a screenshot, chat log, or shared screen.

   **Do not try to fix a wrong Site URL by correcting it.** That was attempted
   four times and reverted every time: the Vercel–Supabase integration rewrites
   it on every deployment, to the team-scoped alias
   `https://sswscoapp-silver-state-waste-solutions.vercel.app/`, which
   Deployment Protection answers with a Vercel login page. It also re-adds the
   allowlist entries shaped
   `https://sswscoapp-*-silver-state-waste-solutions.vercel.app/**` — seeing
   those is how you recognise it. Nothing depends on the Site URL any more, so
   let it drift. What does matter is that `https://sswscoapp.vercel.app/**`
   stays in the redirect allowlist: Supabase discards a `redirect_to` that is
   not on it and falls back to the Site URL.

7. Set `NEXT_PUBLIC_EMAIL_DELIVERY_ENABLED=true` in Vercel and redeploy if it
   is not already. The sign-in screen then offers self-service password reset
   again, and Add Employee grows a "How they get in" choice. While this is
   `false`, Add Employee shows no such choice and always issues a temporary
   password, and every button elsewhere that would email a reset link says so
   rather than reporting a success it cannot deliver — deliberate on both counts.
8. Send one invitation or reset to a reserved account — never a real
   employee — and open the email in a real inbox. Click the link. It should
   open the application's "Set new password" screen. A Vercel login page means
   step 4 or 5 was missed. A `200` from the provider's send API only proves the
   message left their servers, not that it reached an inbox; a real
   click-through is the only step that confirms delivery, not just dispatch.

   One thing to expect: Gmail shows "This message might be dangerous" on these
   emails and strips the link, even though SPF, DKIM and DMARC all pass. It is
   a phishing heuristic, not an authentication failure — the sender is
   `sswsco.com` while the only link points at
   `doofdntdobpixqmcqfnm.supabase.co`, which is the shape of a
   credential-phishing email. Giving the application a custom domain on
   `sswsco.com` would align the two and is the real fix.

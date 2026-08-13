# Client Handoff and Full-Launch Guide

Use this guide only after the exact release commit passes blank-database CI and
authenticated staging acceptance. Production starts with the two approved
administrators, Company Announcements, Dispatch, and at most one controlled
training dataset. Automated E2E identities never enter production.

## State at handoff

Read this section first; it is what is true on the day the system changes hands.

**Working.** Sign-in, all three portals, jobs and dispatch, time clock, pre-trip,
SOPs, messages, invoices, reports, exports, and audit history. Employees are
onboarded with administrator-issued temporary passwords.

**Deliberately deferred.** Three things are switched off by agreement, not by
oversight:

| Deferred | Consequence today | To enable |
| --- | --- | --- |
| Email delivery | **Not planned.** No SMTP, so the system sends no mail at all. Onboarding and password recovery run entirely on administrator-issued temporary passwords, and the sign-in screen says so rather than offering a reset it cannot send. This is a deliberate choice for a small team, not an unfinished feature. | Nothing. If the company later outgrows manual passwords, the optional appendix explains how to switch email on. |
| Administrator MFA | Administrator accounts are password-only. | A deliberate change with factor enrolment rehearsed first — see the accepted risks. |
| 15-minute maintenance cron | Unassigned-job alerts run once daily instead of every 15 minutes. | A Vercel plan supporting sub-daily cron, or an external scheduler calling `/api/cron/maintenance` with `CRON_SECRET`. |

**Accepted risks.** Both were reviewed and accepted; reconfirm them at each
release.

1. *Password-only administrator access.* MFA is not enforced. Compensating
   controls: strong unique passwords, short administrator sessions, Auth and
   application rate limits, immutable owner profiles, active-profile
   enforcement, and audited administrator actions. See the two dashboard
   settings below — the first compensating control is not currently enforced.
2. *Permanent support administrator.* See "Protected administrator profiles"
   below — this one has consequences worth understanding before signing.

**Two dashboard settings worth closing.** Neither is exploitable today and
neither blocks handover, but both are one toggle each and both contradict what
this documentation claims is in place. Verified against production on
August 13, 2026.

*Minimum password length is not enforced by the server.* `/reset-password`
requires 12 characters, but that is browser-side only — the platform accepted a
7-character password when set through the API directly. Since passwords are the
sole authentication factor, this is the compensating control named above, and it
is currently advisory rather than enforced. Fix in Authentication → Sign In /
Providers → set minimum password length to 12. Note `supabase/config.toml`
already specifies 12, but that file governs only local development and never
touches a hosted project — which is why the mismatch went unnoticed.

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
   phone, and active status before giving anyone access. **Until SMTP is
   configured, use the temporary-password path** — it is shown once for you to
   hand over and sends no email. Employees replace it themselves from Change
   Password, and administrators can issue a replacement from the employee page
   if one is lost. The emailed-invitation option only works once SMTP is
   connected; before then its link is never delivered.
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

## Appendix — connecting email later (optional, not planned)

**Skip this section.** The company runs on administrator-issued temporary
passwords by choice, and with a small team that is a complete and reasonable
onboarding method — nothing here is required for the system to work.

Keep it only for the day handing out passwords by hand stops being practical.
Connecting email restores emailed invitations and self-service password reset.

Silver State already has Microsoft 365 (the domain's DNS resolves mail through
Proofpoint to a Microsoft tenant), so **this needs no new vendor** — the
existing mail service can send for the application.

0. **Disable public signup first.** Authentication → Sign In / Providers →
   turn off "Allow new users to sign up". Until email exists, an unconfirmed
   self-signup cannot sign in; once mail is delivered it can, and
   `link_auth_user` would attach it to any employee profile with a matching
   address that has no account yet. Doing this after enabling SMTP leaves a
   window open.
1. In Microsoft 365, enable **SMTP AUTH** on the mailbox that will send. It is
   disabled by default on modern tenants, and security defaults may need
   adjusting; this is the step most likely to need administrator help.
2. In Supabase → Project Settings → Authentication → SMTP Settings, enable
   custom SMTP with host `smtp.office365.com`, port `587`, STARTTLS, and that
   mailbox's credentials.
3. Set the sender to a real monitored address on `sswsco.com`. SPF, DKIM, and
   DMARC already pass for that domain when sending through Microsoft 365; a
   different provider would need new DNS records and the domain currently
   publishes `p=quarantine`, so misaligned mail is quarantined rather than
   delivered.
4. **Repoint the two email templates.** Authentication → Emails, then set the
   link `href` in each. Leave the rest of the HTML alone.

   *Invite user*
   ```
   {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=invite&next=/reset-password
   ```
   *Reset Password*
   ```
   {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/reset-password
   ```

   This is not cosmetic and it is easy to skip. The default
   `{{ .ConfirmationURL }}` returns the token in the URL *fragment* — the part
   after `#` — which browsers never send to a server, so `/auth/confirm` sees
   nothing and bounces the employee to `/login?error=auth_confirm`. Putting
   `token_hash` in the query string is what lets the server redeem it.

   Hardcode `type` as shown. Do not use `{{ .Type }}`: it is not a documented
   Supabase variable, and an empty value makes the route reject the link.
5. Re-confirm the Site URL and redirect allowlist. Production was corrected and
   verified on August 13, 2026 — Site URL `https://sswscoapp.vercel.app`, one
   redirect entry `https://sswscoapp.vercel.app/**` — so this is a regression
   check, not a fix:
   ```
   npm run auth:check-redirect -- --email=<a reserved account>
   ```
   This generates a link and sends nothing. It must report PASS before you rely
   on email — a rewritten redirect means links will dead-end.

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
6. Set `NEXT_PUBLIC_EMAIL_DELIVERY_ENABLED=true` in Vercel and redeploy. The
   sign-in screen then offers self-service password reset again.
7. Send one invitation to yourself end to end before switching any employee over.
   Click the link from a real inbox. If it lands on `/login?error=auth_confirm`,
   step 4 was missed or mistyped.

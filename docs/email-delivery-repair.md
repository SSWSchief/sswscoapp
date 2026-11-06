# Repair email delivery

The customer-confirmation screenshot reports a Resend 403: the `sswsco.com`
sender domain is not verified. Employee invitations use Supabase Auth SMTP,
so check that configuration separately; the invitation screenshot alone does
not expose its underlying provider error.

1. Open Domains in the Resend account whose API key is deployed to the app.
   Add `sswsco.com` if missing, then publish the exact DNS records Resend lists
   at the domain's authoritative DNS provider. Keep the company's existing
   mailbox MX records. Use the record names Resend specifies for sending.
2. Wait for Resend to show the sending domain as **Verified**. If an existing
   verified domain is a subdomain, the sender address must use that exact
   subdomain. A verified subdomain does not verify the root sender address.
3. Customer confirmations and change-request emails use Vercel's
   `RESEND_API_KEY` and optional `RESEND_FROM`. The default sender is
   `Silver State Waste Solutions <notifications@sswsco.com>`. Set `RESEND_FROM`
   if using a different verified sender, then redeploy for the configuration
   to take effect. Never put the API key in a `NEXT_PUBLIC_` variable.
4. In Supabase Authentication SMTP settings, check that custom SMTP uses
   Resend (`smtp.resend.com`, username `resend`, the Resend API key as password,
   and a supported SMTP port). Its sender must also use the verified domain.
   Updating `RESEND_FROM` changes app email only, not Supabase SMTP.
5. Check Supabase Auth logs for the failed invitation's underlying SMTP error.
   Confirm the app's public URL, allowed redirects, and email templates match
   the existing deployment runbook. `NEXT_PUBLIC_EMAIL_DELIVERY_ENABLED=true`
   exposes invitations and password recovery; it does not verify a domain or
   establish that SMTP works.
6. Verify delivery with a designated test account before retrying real messages.
   Confirm a customer confirmation arrives and its links open the public app.
   Confirm an employee invitation arrives and password setup works. Then retry
   the failed customer confirmation and employee creation from the screenshots.
   Until SMTP works, administrators can create employees with a temporary
   password. Failed invitation creation retains the existing profile rollback.

References: [Resend domain verification](https://resend.com/docs/dashboard/domains/introduction),
[exact sender domain matching](https://resend.com/docs/knowledge-base/403-error-domain-mismatch),
and [Resend SMTP](https://resend.com/docs/send-with-smtp).

# Brand assets

The client-supplied master artwork is
`image_references/sswsco logo/IMG_4983.PNG`. Do not redraw or substitute it.

- `public/brand/sswsco-stripe-logo.png` is the canonical non-square logo used
  by the application and uploaded to Stripe Live **Branding → Logo**. It is a
  pixel-preserving resize of the supplied artwork and remains below Stripe's
  512 KB upload limit.
- `public/icons/icon-512.png` is the square derivative used by the installed
  app and uploaded to Stripe Live **Branding → Icon**.

Stripe account branding flows automatically to invoice PDFs, hosted invoice
pages, and customer emails. It is account-level configuration, not a field on
an individual invoice. Keep production invoice sending disabled until the
separate Nevada tax-policy gate is approved.


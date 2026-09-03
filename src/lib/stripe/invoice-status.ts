import type { InvoiceStatus } from "@/lib/types";

/** The five states a Stripe invoice can be in. */
export type StripeInvoiceStatus =
  | "draft"
  | "open"
  | "paid"
  | "uncollectible"
  | "void";

/**
 * Translate Stripe's invoice status into this application's.
 *
 * The two vocabularies almost line up. The one real gap is "overdue", which
 * Stripe does not model at all -- an unpaid invoice is `open` whether it is a
 * day old or a year -- so lateness is decided here by comparing the due date
 * against the moment asked.
 *
 * `uncollectible` maps to `closed` rather than `void`: writing a debt off is
 * not the same as saying the invoice never existed, and the office needs to
 * tell those apart when chasing a general contractor.
 */
export function invoiceStatusFromStripe(
  stripeStatus: StripeInvoiceStatus,
): InvoiceStatus {
  switch (stripeStatus) {
    case "draft":
      return "draft";
    case "paid":
      return "paid";
    case "void":
      return "void";
    case "uncollectible":
      return "uncollectible";
    case "open":
      return "open";
  }
}

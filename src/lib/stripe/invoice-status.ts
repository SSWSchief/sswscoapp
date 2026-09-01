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
  dueDate: string,
  asOf: Date = new Date(),
): InvoiceStatus {
  switch (stripeStatus) {
    case "draft":
      return "draft";
    case "paid":
      return "paid";
    case "void":
      return "void";
    case "uncollectible":
      return "closed";
    case "open": {
      const due = Date.parse(`${dueDate}T23:59:59Z`);
      if (!Number.isFinite(due)) return "sent";
      return asOf.getTime() > due ? "overdue" : "sent";
    }
  }
}

/**
 * Whether an incoming Stripe status should be allowed to overwrite what is
 * already stored.
 *
 * Webhooks arrive out of order and get replayed, so a late `invoice.sent`
 * must not walk a paid invoice backwards. Settled states are terminal here;
 * everything else is free to move.
 */
export function shouldApplyStatus(
  current: InvoiceStatus,
  incoming: InvoiceStatus,
): boolean {
  if (current === incoming) return false;
  const settled: InvoiceStatus[] = ["paid", "void", "closed"];
  if (settled.includes(current)) {
    // A refund or a reopened dispute can legitimately move a paid invoice on,
    // but only to another settled state -- never back to sent or overdue.
    return settled.includes(incoming);
  }
  return true;
}

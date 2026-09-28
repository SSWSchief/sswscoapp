import type { InvoiceRecord } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";

/**
 * Texting an invoice hands the office phone's own Messages app a prefilled
 * message with the Stripe payment link. No SMS provider is involved: sending
 * from the business number needs no carrier (A2P 10DLC) registration, and the
 * customer sees a number they already know.
 */
export function textablePhone(phone: string): string | null {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return null;
}

export function invoiceTextMessage(invoice: InvoiceRecord): string {
  const due = invoice.amountRemainingCents > 0 ? invoice.amountRemainingCents : invoice.amountCents;
  return `Silver State Waste Solutions: invoice ${invoice.invoiceNumber} for ${formatCurrency(due)} is ready. View and pay here: ${invoice.hostedInvoiceUrl}`;
}

/** `?&body=` is the one form both iOS and Android Messages accept. */
export function invoiceSmsHref(invoice: InvoiceRecord, phone: string): string | null {
  const number = textablePhone(phone);
  if (!number || !invoice.hostedInvoiceUrl) return null;
  return `sms:${number}?&body=${encodeURIComponent(invoiceTextMessage(invoice))}`;
}

export const canTextInvoice = (invoice: InvoiceRecord) =>
  Boolean(invoice.hostedInvoiceUrl) && !["draft", "paid", "void"].includes(invoice.status);

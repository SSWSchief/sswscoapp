import { describe, expect, it } from "vitest";
import { canTextInvoice, invoiceSmsHref, invoiceTextMessage, textablePhone } from "./invoice-text";
import type { InvoiceRecord } from "./types";

const invoice = {
  invoiceNumber: "INV-1042",
  status: "open",
  amountCents: 52500,
  amountRemainingCents: 52500,
  hostedInvoiceUrl: "https://invoice.stripe.com/i/acct_1/test_abc?s=ap",
} as InvoiceRecord;

describe("texting an invoice", () => {
  it("normalizes US numbers and rejects ones a phone cannot dial", () => {
    expect(textablePhone("(702) 460-0726")).toBe("+17024600726");
    expect(textablePhone("1-702-460-0726")).toBe("+17024600726");
    expect(textablePhone("460-0726")).toBeNull();
    expect(textablePhone("")).toBeNull();
  });

  it("builds a Messages link carrying the amount and payment page", () => {
    expect(invoiceTextMessage(invoice)).toBe(
      "Silver State Waste Solutions: invoice INV-1042 for $525.00 is ready. View and pay here: https://invoice.stripe.com/i/acct_1/test_abc?s=ap",
    );
    const href = invoiceSmsHref(invoice, "702-460-0726")!;
    expect(href.startsWith("sms:+17024600726?&body=")).toBe(true);
    expect(decodeURIComponent(href.split("body=")[1])).toBe(invoiceTextMessage(invoice));
  });

  it("quotes the remaining balance after a partial payment", () => {
    expect(invoiceTextMessage({ ...invoice, amountRemainingCents: 12500 })).toContain("$125.00");
  });

  it("only offers texting for sent, unpaid invoices", () => {
    expect(canTextInvoice(invoice)).toBe(true);
    expect(canTextInvoice({ ...invoice, status: "paid" })).toBe(false);
    expect(canTextInvoice({ ...invoice, status: "void" })).toBe(false);
    expect(canTextInvoice({ ...invoice, hostedInvoiceUrl: null })).toBe(false);
    expect(invoiceSmsHref({ ...invoice, hostedInvoiceUrl: null }, "7024600726")).toBeNull();
  });
});

import { describe, expect, it } from "vitest";
import { invoiceStatusFromStripe } from "./invoice-status";

describe("invoiceStatusFromStripe", () => {
  it("keeps Stripe's canonical lifecycle", () => {
    expect(invoiceStatusFromStripe("draft")).toBe("draft");
    expect(invoiceStatusFromStripe("open")).toBe("open");
    expect(invoiceStatusFromStripe("paid")).toBe("paid");
    expect(invoiceStatusFromStripe("uncollectible")).toBe("uncollectible");
    expect(invoiceStatusFromStripe("void")).toBe("void");
  });
});

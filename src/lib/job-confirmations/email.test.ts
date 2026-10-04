import { describe, expect, it } from "vitest";
import { confirmationWhen, formatPhone, renderChangeRequestEmail, renderConfirmationEmail } from "./email";

const input = {
  companyName: "Silver State Waste Solutions",
  companyPhone: "7024600726",
  customerName: "John Evans",
  reference: "#1065",
  serviceType: "Delivery",
  dumpsterSize: "20 Yard",
  address: "1816 Mazzanti Way, Henderson, NV 89014",
  // 8:00 AM in Las Vegas.
  scheduledFor: "2026-10-01T15:00:00Z",
  confirmUrl: "https://app.sswsco.com/confirm/abc",
  changeUrl: "https://app.sswsco.com/confirm/abc?change=1#change",
  rescheduled: false,
};

describe("job confirmation email", () => {
  it("tells the customer what, where, and when, in Las Vegas time", () => {
    const email = renderConfirmationEmail(input);
    expect(email.subject).toBe("Delivery scheduled for Thursday, October 1, 2026 (Job #1065)");
    expect(email.text).toContain("Hi John Evans,");
    expect(email.text).toContain("Dumpster: 20 Yard");
    expect(email.text).toContain("Address: 1816 Mazzanti Way, Henderson, NV 89014");
    expect(email.text).toContain("Time: 8:00 AM");
    expect(email.text).toContain("Confirm: https://app.sswsco.com/confirm/abc");
    expect(email.text).toContain("Request a change: https://app.sswsco.com/confirm/abc?change=1#change");
    expect(email.text).toContain("call (702) 460-0726");
    expect(email.html).toContain('href="https://app.sswsco.com/confirm/abc"');
  });

  it("says when it replaces an earlier time", () => {
    const email = renderConfirmationEmail({ ...input, rescheduled: true });
    expect(email.subject).toMatch(/^Updated: /);
    expect(email.text).toContain("has been rescheduled");
  });

  it("cannot be made to carry markup from a customer or address", () => {
    const email = renderConfirmationEmail({ ...input, customerName: "<script>x</script>", address: 'A & B "Yard"' });
    expect(email.html).not.toContain("<script>");
    expect(email.html).toContain("&lt;script&gt;");
    expect(email.html).toContain("A &amp; B &quot;Yard&quot;");
  });

  it("greets without a name when there is none", () => {
    expect(renderConfirmationEmail({ ...input, customerName: " " }).text.startsWith("Hello,")).toBe(true);
  });
});

describe("formatting", () => {
  it("reads dates and phones the way the office writes them", () => {
    expect(confirmationWhen("2026-12-01T00:30:00Z")).toEqual({ date: "Monday, November 30, 2026", time: "4:30 PM" });
    expect(formatPhone("+1 702-460-0726")).toBe("(702) 460-0726");
    expect(formatPhone("ext 12")).toBe("ext 12");
  });
});

describe("change request to dispatch", () => {
  it("names the job, the customer, and their note", () => {
    const email = renderChangeRequestEmail({
      reference: "#1065", customerName: "John Evans", recipientEmail: "john@example.com",
      scheduledFor: input.scheduledFor, note: "Can you come Friday instead?", jobUrl: "https://app.sswsco.com/dispatcher/jobs/j1",
    });
    expect(email.subject).toBe("Change requested: Job #1065 (John Evans)");
    expect(email.text).toContain("Their note: Can you come Friday instead?");
    expect(email.text).toContain("Open the job: https://app.sswsco.com/dispatcher/jobs/j1");
  });
});

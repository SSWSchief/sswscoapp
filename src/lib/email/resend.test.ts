import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sendEmail } from "./resend";

const email = {
  to: "customer@example.com",
  subject: "Job confirmation",
  text: "Please confirm your job.",
  replyTo: "Dispatch@sswsco.com",
  idempotencyKey: "job-confirmation:test",
};
const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  vi.stubEnv("RESEND_API_KEY", "re_test");
  vi.stubEnv("RESEND_FROM", "");
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  fetchMock.mockReset();
});

describe("Resend email delivery", () => {
  it("keeps the company sender and retry protection by default", async () => {
    fetchMock.mockResolvedValue(Response.json({ id: "email-1" }));

    await expect(sendEmail(email)).resolves.toBe("email-1");

    const [url, request] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.resend.com/emails");
    expect(request?.headers).toMatchObject({ "idempotency-key": email.idempotencyKey });
    expect(JSON.parse(request?.body as string)).toMatchObject({
      from: "Silver State Waste Solutions <notifications@sswsco.com>",
      to: [email.to],
      reply_to: email.replyTo,
    });
  });

  it("uses the configured verified sender including a sending subdomain", async () => {
    vi.stubEnv("RESEND_FROM", " Silver State Waste Solutions <notifications@mail.sswsco.com> ");
    fetchMock.mockResolvedValue(Response.json({ id: "email-2" }));

    await sendEmail(email);

    const request = fetchMock.mock.calls[0][1];
    expect(JSON.parse(request?.body as string).from).toBe(
      "Silver State Waste Solutions <notifications@mail.sswsco.com>",
    );
  });

  it("explains how to recover from the domain error in Austin's screenshot", async () => {
    fetchMock.mockResolvedValue(Response.json({
      message: "The sswsco.com domain is not verified. Please, add and verify your domain on https://resend.com/domains",
    }, { status: 403 }));

    await expect(sendEmail(email)).rejects.toThrow(
      "Email not sent: verify sswsco.com in the Resend account used by this app, or set RESEND_FROM to an address on its verified domain. Then resend.",
    );
  });

  it("preserves other provider errors without mistaking them for domain failures", async () => {
    fetchMock.mockResolvedValue(Response.json({ message: "API key is invalid" }, { status: 403 }));

    await expect(sendEmail(email)).rejects.toThrow("Email was not accepted (403: API key is invalid).");
  });

  it("does not report success when the provider returns no message ID", async () => {
    fetchMock.mockResolvedValue(Response.json({}));

    await expect(sendEmail(email)).rejects.toThrow("Email was not accepted (200).");
  });

  it("does not call the provider without an API key", async () => {
    vi.stubEnv("RESEND_API_KEY", "");

    await expect(sendEmail(email)).rejects.toThrow("Customer email is not configured.");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

import "server-only";

/**
 * Customer email through Resend, the provider already verified for
 * sswsco.com (staff invitations go through it via Supabase SMTP). The app
 * sends with its own API key, `RESEND_API_KEY`; until that is set, customer
 * email is off and nothing tries to send.
 */
const CUSTOMER_EMAIL_FROM = "Silver State Waste Solutions <notifications@sswsco.com>";

export function customerEmailConfigured() {
  return Boolean(process.env.RESEND_API_KEY?.startsWith("re_"));
}

/** Where replies and change requests go: the dispatch inbox. */
export function dispatchEmail() {
  return process.env.DISPATCH_EMAIL || "Dispatch@sswsco.com";
}

interface OutgoingEmail {
  to: string;
  subject: string;
  text: string;
  html?: string;
  replyTo?: string;
  /** Resend drops a repeat send with the same key, so a retry cannot double-send. */
  idempotencyKey: string;
}

export async function sendEmail(email: OutgoingEmail): Promise<string> {
  const key = process.env.RESEND_API_KEY;
  if (!key?.startsWith("re_")) throw new Error("Customer email is not configured.");
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${key}`,
      "content-type": "application/json",
      "idempotency-key": email.idempotencyKey,
    },
    body: JSON.stringify({
      from: CUSTOMER_EMAIL_FROM,
      to: [email.to],
      subject: email.subject,
      text: email.text,
      ...(email.html ? { html: email.html } : {}),
      ...(email.replyTo ? { reply_to: email.replyTo } : {}),
    }),
  });
  const body = (await response.json().catch(() => ({}))) as { id?: string; message?: string };
  if (!response.ok || !body.id)
    throw new Error(`Email was not accepted (${response.status}${body.message ? `: ${body.message}` : ""}).`);
  return body.id;
}

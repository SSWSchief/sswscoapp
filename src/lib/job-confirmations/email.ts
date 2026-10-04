/**
 * The job confirmation email a customer receives once dispatch books their
 * job (Austin's request, 2026-10-01). Modeled on the order confirmation Austin
 * forwarded as an example: what was ordered, where, and when, then two
 * buttons. Kept to inline styles and one table, which is what survives
 * Outlook, Gmail and phone mail apps alike.
 */
interface ConfirmationEmailInput {
  companyName: string;
  companyPhone: string;
  customerName: string;
  reference: string;
  serviceType: string;
  dumpsterSize: string;
  address: string;
  scheduledFor: string;
  confirmUrl: string;
  changeUrl: string;
  /** True when this replaces an earlier confirmation for a changed time. */
  rescheduled: boolean;
}

const zone = "America/Los_Angeles";

/** "Thursday, October 1, 2026" and "8:00 AM", in Las Vegas time. */
export function confirmationWhen(iso: string) {
  const at = new Date(iso);
  return {
    date: at.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: zone }),
    time: at.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: zone }),
  };
}

/** (702) 460-0726 from any ten-digit form; anything else is left alone. */
export function formatPhone(phone: string) {
  const digits = phone.replace(/\D/g, "").replace(/^1(?=\d{10}$)/, "");
  return digits.length === 10 ? `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}` : phone;
}

const escape = (value: string) =>
  value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character] as string);

export function renderConfirmationEmail(input: ConfirmationEmailInput) {
  const when = confirmationWhen(input.scheduledFor);
  const phone = formatPhone(input.companyPhone);
  const greeting = input.customerName.trim() ? `Hi ${input.customerName.trim()},` : "Hello,";
  const lead = input.rescheduled
    ? `Your ${input.serviceType.toLowerCase()} has been rescheduled. Here are the new details.`
    : `Thank you for choosing ${input.companyName}. We've received your order and scheduled it.`;
  const subject = `${input.rescheduled ? "Updated: " : ""}${input.serviceType} scheduled for ${when.date} (Job ${input.reference})`;
  const details: Array<[string, string]> = [
    ["Job", input.reference],
    ["Service", input.serviceType],
    ["Dumpster", input.dumpsterSize],
    ["Address", input.address],
    ["Date", when.date],
    ["Time", when.time],
  ];

  const text = [
    greeting,
    "",
    lead,
    "",
    ...details.map(([label, value]) => `${label}: ${value}`),
    "",
    `Confirm: ${input.confirmUrl}`,
    `Request a change: ${input.changeUrl}`,
    "",
    phone ? `Questions? Reply to this email or call ${phone}.` : "Questions? Reply to this email.",
    "",
    input.companyName,
  ].join("\n");

  const rows = details
    .map(([label, value]) => `<tr><td style="padding:6px 12px 6px 0;color:#5b6b7b;font-size:14px;white-space:nowrap;vertical-align:top">${escape(label)}</td><td style="padding:6px 0;color:#1d2731;font-size:14px;font-weight:600">${escape(value)}</td></tr>`)
    .join("");
  const button = (href: string, label: string, primary: boolean) =>
    `<a href="${escape(href)}" style="display:inline-block;margin:6px 8px 6px 0;padding:12px 20px;border-radius:6px;font-size:15px;font-weight:600;text-decoration:none;${primary ? "background:#0b5394;color:#ffffff" : "background:#ffffff;color:#0b5394;border:1px solid #0b5394"}">${escape(label)}</a>`;
  const html = `<!doctype html><html><body style="margin:0;padding:0;background:#f3f6f9;font-family:Arial,Helvetica,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f6f9;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:8px;padding:24px">
<tr><td style="font-size:18px;font-weight:700;color:#0b5394;padding-bottom:16px">${escape(input.companyName)}</td></tr>
<tr><td style="font-size:15px;color:#1d2731;padding-bottom:8px">${escape(greeting)}</td></tr>
<tr><td style="font-size:15px;color:#1d2731;padding-bottom:16px">${escape(lead)}</td></tr>
<tr><td><table role="presentation" cellpadding="0" cellspacing="0">${rows}</table></td></tr>
<tr><td style="font-size:15px;color:#1d2731;padding:20px 0 4px">Does this look right?</td></tr>
<tr><td>${button(input.confirmUrl, "Confirm", true)}${button(input.changeUrl, "Request a change", false)}</td></tr>
<tr><td style="font-size:13px;color:#5b6b7b;padding-top:20px">${escape(phone ? `Questions? Reply to this email or call ${phone}.` : "Questions? Reply to this email.")}</td></tr>
</table></td></tr></table></body></html>`;

  return { subject, text, html };
}

/** The note dispatch gets when a customer asks for a change. */
export function renderChangeRequestEmail(input: {
  reference: string;
  customerName: string;
  recipientEmail: string;
  scheduledFor: string;
  note: string;
  jobUrl: string;
}) {
  const when = confirmationWhen(input.scheduledFor);
  const subject = `Change requested: Job ${input.reference} (${input.customerName || input.recipientEmail})`;
  const text = [
    `${input.customerName || input.recipientEmail} asked for a change to job ${input.reference}, scheduled ${when.date} at ${when.time}.`,
    "",
    `Their note: ${input.note.trim() || "(none)"}`,
    "",
    `Reply to this email to reach them at ${input.recipientEmail}.`,
    `Open the job: ${input.jobUrl}`,
  ].join("\n");
  return { subject, text };
}

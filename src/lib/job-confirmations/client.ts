/**
 * Ask the server to email the customer a job's confirmation. Called right
 * after dispatch books or reschedules a job, where a refusal (emails off, no
 * address on file) is not an error: the job page shows the state and offers
 * to send.
 */
export function requestJobConfirmation(jobId: string, email?: string) {
  return fetch(`/api/jobs/${encodeURIComponent(jobId)}/confirmation`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(email ? { email } : {}),
  });
}

/** Fire and forget: the booking already succeeded, whatever the email does. */
export function confirmJobInBackground(jobId: string) {
  void requestJobConfirmation(jobId).catch(() => undefined);
}

/** Whether an edit changed what the customer was told: the time or the place. */
export function changesCustomerDetails(
  before: { scheduledFor: string; address: string },
  after: { scheduledFor: string; address: string },
) {
  return new Date(before.scheduledFor).getTime() !== new Date(after.scheduledFor).getTime() ||
    before.address.trim() !== after.address.trim();
}

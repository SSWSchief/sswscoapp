const placeholderValues = new Set([
  "",
  "your-vapid-public-key",
  "your-vapid-private-key",
  "mailto:you@your-domain",
]);

export function getPublicVapidKey(): string {
  const value = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!value || placeholderValues.has(value))
    throw new Error("NEXT_PUBLIC_VAPID_PUBLIC_KEY is not configured.");
  return value;
}

/**
 * Which half of the push configuration is present, as booleans. Reported by
 * /api/health so a deployment missing its keys can be spotted in one request
 * rather than inferred from notifications that never arrive.
 */
export function pushConfigurationStatus() {
  const present = (value: string | undefined) =>
    Boolean(value) && !placeholderValues.has(value as string);
  const publicKey = present(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY);
  const privateKey = present(process.env.VAPID_PRIVATE_KEY);
  const subject = present(process.env.VAPID_SUBJECT);
  return {
    configured: publicKey && privateKey && subject,
    publicKey,
    privateKey,
    subject,
  };
}

export function getPushEnv() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  if (!publicKey || placeholderValues.has(publicKey))
    throw new Error("NEXT_PUBLIC_VAPID_PUBLIC_KEY is not configured.");
  if (!privateKey || placeholderValues.has(privateKey))
    throw new Error("VAPID_PRIVATE_KEY is not configured.");
  if (!subject || placeholderValues.has(subject))
    throw new Error("VAPID_SUBJECT is not configured.");
  return { publicKey, privateKey, subject };
}

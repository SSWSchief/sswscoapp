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

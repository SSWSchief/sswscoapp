export function acceptanceEnvironmentAvailable(required: string[]) {
  const missing = required.filter((name) => !process.env[name]);
  if (process.env.E2E_REQUIRED === "true" && missing.length)
    throw new Error(
      `Required staging acceptance variables are missing: ${missing.join(", ")}`,
    );
  return missing.length === 0;
}

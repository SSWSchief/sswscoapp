import type { User } from "./types";

export const ownerEmails = [
  "amarshall@sswsco.com",
  "tehronporter@gmail.com",
] as const;

export function isOwnerEmail(email: string | null | undefined) {
  return ownerEmails.includes(
    (email ?? "").trim().toLowerCase() as (typeof ownerEmails)[number],
  );
}

export function isOwnerProfile(user: Pick<User, "email"> | null | undefined) {
  return isOwnerEmail(user?.email);
}

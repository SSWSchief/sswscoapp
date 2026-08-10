import type { User } from "./types";

export function isProtectedAdministrator(
  user: Pick<User, "id"> | null | undefined,
  protectedAdministratorIds: readonly string[],
) {
  return Boolean(user && protectedAdministratorIds.includes(user.id));
}

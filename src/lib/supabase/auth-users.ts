/**
 * Finding an existing Auth account by email.
 *
 * GoTrue exposes no lookup-by-email, only a paged listing, so both the employee
 * create route and the temporary-password route have to walk it. They share the
 * walk from here rather than keeping two copies that can drift apart.
 */

/** The slice of `admin.auth.admin` this needs — narrow enough to stub in tests. */
export type AuthUserDirectory = {
  listUsers: (params: { page: number; perPage: number }) => Promise<{
    data: { users: { id: string; email?: string | null }[] } | null;
    error: unknown;
  }>;
};

const perPage = 1000;
// A directory this size is far beyond anything the business runs, so the cap is
// a guard against an unbounded loop rather than a real limit.
const maximumPages = 20;

/**
 * The Auth account id for `email`, or `null` when no account exists.
 *
 * Returns `ok: false` when the directory could not be read, which callers must
 * treat as unknown rather than absent — assuming absence would have them try to
 * create an account that is already there.
 */
export async function findAuthUserIdByEmail(
  directory: AuthUserDirectory,
  email: string,
): Promise<{ ok: true; id: string | null } | { ok: false }> {
  const wanted = email.toLowerCase();
  for (let page = 1; page <= maximumPages; page += 1) {
    const listed = await directory.listUsers({ page, perPage });
    if (listed.error || !listed.data) return { ok: false };
    const match = listed.data.users.find(
      (candidate) => candidate.email?.toLowerCase() === wanted,
    );
    if (match) return { ok: true, id: match.id };
    if (listed.data.users.length < perPage) break;
  }
  return { ok: true, id: null };
}

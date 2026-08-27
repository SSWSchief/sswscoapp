import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";
import type { User } from "@/lib/types";

export const EMPLOYEE_PHOTO_BUCKET = "employee-photos";

/**
 * Employee photos live in a private bucket, so displaying one means signing a
 * URL for it. The operations provider refreshes on every realtime event, and
 * signing the same handful of paths on each of those would be a storage round
 * trip per employee per event — so signatures are cached here until they are
 * close enough to expiry to be worth replacing.
 */
const TTL_SECONDS = 8 * 60 * 60;
/** Re-signed this long before expiry, so a URL handed out is never nearly dead. */
const REFRESH_MARGIN_MS = 60 * 60 * 1000;

const cache = new Map<string, { url: string; expiresAt: number }>();

export async function attachAvatarUrls<T extends User>(
  db: Pick<SupabaseClient<Database>, "storage">,
  users: T[],
): Promise<T[]> {
  const now = Date.now();
  const wanted = new Set(
    users
      .map((user) => user.avatarPath)
      .filter((path): path is string => Boolean(path)),
  );
  const missing = [...wanted].filter((path) => {
    const cached = cache.get(path);
    return !cached || cached.expiresAt - REFRESH_MARGIN_MS <= now;
  });
  if (missing.length > 0) {
    const signed = await db.storage
      .from(EMPLOYEE_PHOTO_BUCKET)
      .createSignedUrls(missing, TTL_SECONDS);
    for (const row of signed.data ?? []) {
      // `path` is echoed back per entry, so a partial failure only drops the
      // photos that actually failed rather than misaligning the rest.
      if (row.path && row.signedUrl)
        cache.set(row.path, {
          url: row.signedUrl,
          expiresAt: now + TTL_SECONDS * 1000,
        });
    }
  }
  // A path with no signature keeps its initials avatar; nothing here is fatal.
  return users.map((user) => {
    const url = user.avatarPath ? cache.get(user.avatarPath)?.url : undefined;
    return url ? { ...user, avatarUrl: url } : user;
  });
}

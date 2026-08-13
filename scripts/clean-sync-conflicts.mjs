/**
 * Deletes cloud-sync conflict copies from the source tree.
 *
 * This repository lives in iCloud Drive, which resolves a sync race by writing
 * a numbered duplicate beside the original — `middleware 2.ts` next to
 * `middleware.ts`. They are gitignored, so they never reach a commit, but `tsc`
 * and `knip` still read everything under `src/`, and a stale duplicate that
 * references an API the real file has since renamed fails the build with an
 * error pointing at a file the author has never heard of.
 *
 * Canonical sources never carry a numeric suffix, so anything matching is safe
 * to remove. Runs first in `npm run check`.
 */
import { readdir, rm } from "node:fs/promises";
import { join } from "node:path";

// `.next/types` is generated, but tsconfig includes it explicitly, so a
// conflict copy there fails `tsc` exactly like one in `src`.
const roots = ["src", "e2e", "scripts", "supabase", ".next/types"];
// "name 2.ts", "name 2.test.ts", ".eslintrc 2.json" — a space, digits, then an
// extension. Anchored so an ordinary name containing a digit is never matched.
const conflict = /(^|.+?) \d+(\.[^.]+)+$/;

async function walk(directory) {
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch {
    return [];
  }
  const found = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) found.push(...(await walk(path)));
    else if (conflict.test(entry.name)) found.push(path);
  }
  return found;
}

const found = (await Promise.all(roots.map(walk))).flat();
for (const path of found) await rm(path, { force: true });

console.log(
  found.length
    ? `Removed ${found.length} sync conflict file(s):\n  ${found.join("\n  ")}`
    : "No sync conflict files found.",
);

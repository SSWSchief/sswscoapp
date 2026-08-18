import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import test from "node:test";

const execFileAsync = promisify(execFile);
// Same decoding caveat as the import-operations tests: this checkout lives
// under a path with spaces.
const script = fileURLToPath(
  new URL("./check-auth-redirect.mjs", import.meta.url),
);

const production = "doofdntdobpixqmcqfnm";
const staging = "xdofuqocgkftrhhxfspp";

/**
 * Runs from an empty directory so the repository's own `.env.local` — which
 * points at staging — cannot leak in and decide the result.
 */
async function run(args, env) {
  const directory = await mkdtemp(join(tmpdir(), "sswsco-auth-check-"));
  try {
    const result = await execFileAsync(process.execPath, [script, ...args], {
      cwd: directory,
      env: { PATH: process.env.PATH, ...env },
    });
    return { code: 0, ...result };
  } catch (error) {
    return { code: error.code, stdout: error.stdout, stderr: error.stderr };
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

test("refuses to check a project other than production", async () => {
  const { code, stderr } = await run([`--email=reserved@example.invalid`], {
    NEXT_PUBLIC_SUPABASE_URL: `https://${staging}.supabase.co`,
    SUPABASE_SECRET_KEY: "sb_secret_unused",
  });

  assert.equal(code, 1);
  // Names both sides: the misleading run this exists to prevent reported a
  // confident FAIL without ever saying which project it had checked.
  assert.match(stderr, new RegExp(staging));
  assert.match(stderr, new RegExp(production));
  assert.match(stderr, /Refusing to run/);
});

test("fails on the mismatch before asking for a secret key", async () => {
  const { code, stderr } = await run([`--email=reserved@example.invalid`], {
    NEXT_PUBLIC_SUPABASE_URL: `https://${staging}.supabase.co`,
  });

  assert.equal(code, 1);
  assert.match(stderr, /Refusing to run/);
  assert.doesNotMatch(stderr, /SUPABASE_SECRET_KEY is required/);
});

test("checks another project when told to explicitly", async () => {
  const { code, stderr } = await run(
    [`--email=reserved@example.invalid`, `--project=${staging}`],
    { NEXT_PUBLIC_SUPABASE_URL: `https://${staging}.supabase.co` },
  );

  // Past the guard, so it now fails on the credential it genuinely needs.
  assert.equal(code, 1);
  assert.doesNotMatch(stderr, /Refusing to run/);
  assert.match(stderr, /SUPABASE_SECRET_KEY is required/);
});

test("lets production through the guard", async () => {
  const { code, stderr } = await run([`--email=reserved@example.invalid`], {
    NEXT_PUBLIC_SUPABASE_URL: `https://${production}.supabase.co`,
  });

  assert.equal(code, 1);
  assert.doesNotMatch(stderr, /Refusing to run/);
  assert.match(stderr, /SUPABASE_SECRET_KEY is required/);
});

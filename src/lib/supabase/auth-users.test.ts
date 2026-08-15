import { describe, expect, it, vi } from "vitest";
import { findAuthUserIdByEmail, type AuthUserDirectory } from "./auth-users";

function directory(pages: { id: string; email?: string | null }[][]) {
  return {
    listUsers: vi.fn(async ({ page }: { page: number; perPage: number }) => ({
      data: { users: pages[page - 1] ?? [] },
      error: null,
    })),
  } satisfies AuthUserDirectory;
}

/** A full page, so the walk continues past it. */
function filler(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    id: `filler-${index}`,
    email: `filler-${index}@example.com`,
  }));
}

describe("findAuthUserIdByEmail", () => {
  it("finds an account regardless of the case it was stored in", async () => {
    const source = directory([[{ id: "abc", email: "Julianne.Montoya4@GMAIL.com" }]]);
    await expect(
      findAuthUserIdByEmail(source, "julianne.montoya4@gmail.com"),
    ).resolves.toEqual({ ok: true, id: "abc" });
  });

  it("reports absence separately from failure", async () => {
    const source = directory([[{ id: "abc", email: "someone@example.com" }]]);
    await expect(
      findAuthUserIdByEmail(source, "nobody@example.com"),
    ).resolves.toEqual({ ok: true, id: null });
  });

  it("stops at the first short page rather than walking the cap", async () => {
    const source = directory([[{ id: "abc", email: "someone@example.com" }]]);
    await findAuthUserIdByEmail(source, "nobody@example.com");
    expect(source.listUsers).toHaveBeenCalledTimes(1);
  });

  it("keeps paging while pages come back full", async () => {
    const source = directory([filler(1000), [{ id: "found", email: "late@example.com" }]]);
    await expect(
      findAuthUserIdByEmail(source, "late@example.com"),
    ).resolves.toEqual({ ok: true, id: "found" });
    expect(source.listUsers).toHaveBeenCalledTimes(2);
  });

  it("does not report absence when the directory could not be read", async () => {
    const source: AuthUserDirectory = {
      listUsers: async () => ({ data: null, error: new Error("unreachable") }),
    };
    // The distinction matters: a caller told "no account" would try to create
    // one that may already exist.
    await expect(
      findAuthUserIdByEmail(source, "someone@example.com"),
    ).resolves.toEqual({ ok: false });
  });
});

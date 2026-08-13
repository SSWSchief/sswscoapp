import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";
import { acceptanceEnvironmentAvailable } from "./environment";

/**
 * Administrator-issued temporary passwords are the only way anyone gets into
 * this system: no SMTP is configured, so there are no invitation emails and no
 * self-service reset. That makes this path the single point of failure for
 * every new hire, and until now only the password *generator* was tested.
 *
 * This exercises the whole path against staging — profile, account, first
 * sign-in, password change, and the old password ceasing to work — and cleans
 * up whatever it created.
 */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishable = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const secret = process.env.SUPABASE_SECRET_KEY;
const available = acceptanceEnvironmentAvailable([
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_SECRET_KEY",
]);

// Matches src/lib/temporary-password.ts: no characters that are misread when a
// password is written down or read aloud.
const alphabet = "ABCDEFGHJKMNPQRTUVWXYabcdefghijkmnpqrtuvwxy346789";
const temporaryPassword = () =>
  Array.from(
    randomBytes(16),
    (byte) => alphabet[byte % alphabet.length],
  ).join("");

test.describe("temporary-password onboarding", () => {
  test.skip(
    ({ browserName }) => browserName !== "chromium" || !available,
    "Runs once against bootstrapped staging",
  );

  test("an administrator can onboard an employee without email", async () => {
    // Guard rather than trust configuration: this test creates and deletes
    // accounts, and must never do that against the client's live database.
    expect(
      new URL(url!).hostname.split(".")[0],
      "onboarding probe must not run against production",
    ).not.toBe("doofdntdobpixqmcqfnm");

    const admin = createClient(url!, secret!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const employee = () =>
      createClient(url!, publishable!, {
        auth: { persistSession: false, autoRefreshToken: false },
      });

    const suffix = randomBytes(4).toString("hex");
    const email = `e2e.onboarding.${suffix}@staging.example.com`;
    const profileId = `e2e-onboarding-${suffix}`;
    const issued = temporaryPassword();
    let authUserId: string | null = null;

    try {
      const profile = await admin
        .from("users")
        .insert({
          id: profileId,
          employee_id: `E2E-ONB-${suffix.toUpperCase()}`,
          full_name: "E2E Onboarding Driver",
          email,
          phone: "",
          role: "driver",
          access_role: "driver",
          status: "active",
          initials: "EO",
          permission_overrides: {},
        })
        .select()
        .single();
      expect(profile.error, profile.error?.message).toBeNull();

      const created = await admin.auth.admin.createUser({
        email,
        password: issued,
        email_confirm: true,
        user_metadata: { full_name: "E2E Onboarding Driver" },
      });
      expect(created.error, created.error?.message).toBeNull();
      authUserId = created.data.user?.id ?? null;
      expect(authUserId).toBeTruthy();

      // link_auth_user fires on insert into auth.users and attaches the account
      // to the profile by email. If this regresses the employee signs in to no
      // workspace at all, which is hard to diagnose from the outside.
      const linked = await admin
        .from("users")
        .select("auth_user_id")
        .eq("id", profileId)
        .single();
      expect(linked.data?.auth_user_id).toBe(authUserId);

      const first = await employee().auth.signInWithPassword({
        email,
        password: issued,
      });
      expect(first.error, first.error?.message).toBeNull();
      expect(first.data.session).toBeTruthy();

      const session = employee();
      await session.auth.setSession(first.data.session!);
      const chosen = `Chosen-${randomBytes(9).toString("hex")}`;
      const changed = await session.auth.updateUser({ password: chosen });
      expect(changed.error, changed.error?.message).toBeNull();

      const reuse = await employee().auth.signInWithPassword({
        email,
        password: issued,
      });
      expect(
        reuse.error,
        "the issued temporary password must stop working once replaced",
      ).not.toBeNull();

      const withChosen = await employee().auth.signInWithPassword({
        email,
        password: chosen,
      });
      expect(withChosen.error, withChosen.error?.message).toBeNull();
    } finally {
      if (authUserId) await admin.auth.admin.deleteUser(authUserId);
      await admin.from("users").delete().eq("id", profileId);
    }
  });
});

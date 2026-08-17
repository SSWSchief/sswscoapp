import { describe, expect, it } from "vitest";
import {
  employeeConflictMessage,
  escapeLikePattern,
  isUniqueViolation,
  uniqueViolationField,
} from "./employee-conflict";

describe("employee conflicts", () => {
  it("names the column behind a unique violation", () => {
    expect(
      uniqueViolationField({
        code: "23505",
        message:
          'duplicate key value violates unique constraint "users_employee_id_key"',
      }),
    ).toBe("employee_id");
    expect(
      uniqueViolationField({
        code: "23505",
        message:
          'duplicate key value violates unique constraint "users_email_key"',
      }),
    ).toBe("email");
  });

  it("recognises a duplicate reported without a SQLSTATE", () => {
    expect(
      uniqueViolationField({
        message:
          'duplicate key value violates unique constraint "users_email_key"',
      }),
    ).toBe("email");
  });

  it("claims no conflict for failures that are not one", () => {
    // The old route answered every insert failure with "already exists", which
    // sent administrators editing details that were never the problem.
    expect(uniqueViolationField({ code: "08006", message: "connection lost" })).toBeNull();
    expect(uniqueViolationField(null)).toBeNull();
    expect(isUniqueViolation({ code: "23503", message: "foreign key" })).toBe(false);
    // A unique violation on a column the administrator did not type.
    expect(
      uniqueViolationField({
        code: "23505",
        message:
          'duplicate key value violates unique constraint "users_auth_user_id_key"',
      }),
    ).toBeNull();
  });

  it("says which field collided, with whom, and what to do", () => {
    expect(
      employeeConflictMessage("employee_id", "Owner", {
        fullName: "Eli Montoya",
        removed: false,
        inactive: false,
      }),
    ).toBe(
      "Employee ID “Owner” is already used by Eli Montoya. Give this employee a different Employee ID.",
    );
    expect(
      employeeConflictMessage("email", "fred@sswsco.com", null),
    ).toContain("is already in use");
  });

  it("explains a holder that the employee list does not show", () => {
    const removed = employeeConflictMessage("email", "fred@sswsco.com", {
      fullName: "Fred Dakake",
      removed: true,
      inactive: false,
    });
    expect(removed).toContain("removed record for Fred Dakake");
    expect(removed).toContain("does not appear in the employee list");
    const inactive = employeeConflictMessage("employee_id", "007", {
      fullName: "Fred Dakake",
      removed: false,
      inactive: true,
    });
    expect(inactive).toContain("reactivate that profile");
  });

  it("keeps LIKE wildcards out of an email lookup", () => {
    // `_` is legal in an address and matches any character in a pattern, which
    // would report a collision with an address nobody typed.
    expect(escapeLikePattern("fred_d@sswsco.com")).toBe("fred\\_d@sswsco.com");
    expect(escapeLikePattern("a%b\\c")).toBe("a\\%b\\\\c");
  });
});

import { describe, expect, it } from "vitest";
import { employeeWriteFailure, writeErrorDetail } from "./employee-conflicts";

// Shapes as PostgREST reports them, so the mapping is tested against the
// wording the database actually produces.
const duplicateEmployeeId = {
  code: "23505",
  message:
    'duplicate key value violates unique constraint "users_employee_id_key"',
  details: "Key (employee_id)=(Owner) already exists.",
};
const duplicateEmail = {
  code: "23505",
  message: 'duplicate key value violates unique constraint "users_email_key"',
  details: "Key (email)=(fdakake@sswsco.com) already exists.",
};

describe("employee write failures", () => {
  it("names the Employee ID that collided", () => {
    const failure = employeeWriteFailure(duplicateEmployeeId, {
      employeeId: "Owner",
    });
    expect(failure?.code).toBe("employee_id_taken");
    expect(failure?.status).toBe(409);
    expect(failure?.message).toContain('Employee ID "Owner"');
    // The row holding it may be soft-deleted and therefore off every screen the
    // administrator can reach, which is why the message has to raise it.
    expect(failure?.message).toContain("removed");
  });

  it("separates an email collision from an Employee ID collision", () => {
    const failure = employeeWriteFailure(duplicateEmail, {
      employeeId: "Owner",
    });
    expect(failure?.code).toBe("email_taken");
    expect(failure?.message).toContain("email address");
    expect(failure?.message).not.toContain("Employee ID");
  });

  it("reports an incompatible role pair as a rejected input", () => {
    const failure = employeeWriteFailure({
      code: "23514",
      message:
        'new row violates check constraint "users_role_access_compatible"',
      details: null,
    });
    expect(failure).toEqual({
      code: "incompatible_role",
      status: 400,
      message: "Operational role and access role are incompatible.",
    });
  });

  it("leaves unrelated database failures to the caller", () => {
    expect(
      employeeWriteFailure({ code: "08006", message: "connection failure" }),
    ).toBeNull();
    expect(employeeWriteFailure(null)).toBeNull();
  });

  it("keeps the constraint wording for the request log", () => {
    expect(writeErrorDetail(duplicateEmployeeId)).toEqual({
      pgCode: "23505",
      pgMessage:
        'duplicate key value violates unique constraint "users_employee_id_key"',
      pgDetails: "Key (employee_id)=(Owner) already exists.",
    });
  });
});

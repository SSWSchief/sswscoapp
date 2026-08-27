import type { User } from "./types";

/**
 * What an employee's row should say, as opposed to what `users.status` holds.
 *
 * The database has two states, active and inactive, and both mean something
 * about authorization: an inactive employee is banned from signing in. Neither
 * says whether the person has ever actually used the account. Every employee
 * created since launch has therefore read as Active from the moment their
 * profile was written — including the ones who were handed a password and
 * never signed in, which is most of a first week's worth of test accounts.
 *
 * Pending is that missing third reading, derived rather than stored: an active
 * employee whose account has never been signed into. Authorization is
 * unchanged — they are an active employee, and the moment they sign in the
 * badge changes on its own.
 */
type EmployeeDisplayStatus = "active" | "pending" | "inactive";

export function employeeDisplayStatus(
  employee: Pick<User, "status" | "activatedAt">,
): EmployeeDisplayStatus {
  if (employee.status !== "active") return "inactive";
  return employee.activatedAt ? "active" : "pending";
}

export const employeeStatusLabel: Record<EmployeeDisplayStatus, string> = {
  active: "Active",
  pending: "Pending",
  inactive: "Inactive",
};

export const employeeStatusTone: Record<
  EmployeeDisplayStatus,
  "green" | "amber" | "gray"
> = {
  active: "green",
  pending: "amber",
  inactive: "gray",
};

export const employeeStatusHint: Record<EmployeeDisplayStatus, string> = {
  active: "Has signed in and can use the app.",
  pending: "Account created, but they have never signed in yet.",
  inactive: "Deactivated — sign-in is blocked.",
};

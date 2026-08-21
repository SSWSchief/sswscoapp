/**
 * Explaining why an employee could not be saved.
 *
 * `public.users` is unique on `employee_id` and on `email`, and both write paths
 * used to answer every failure with one sentence — "An employee with those
 * details already exists." An administrator reading that cannot tell which of
 * the two fields to change, and the sentence is simply untrue when the write
 * failed for some other reason. These helpers name the field, name the employee
 * already holding it, and say why that employee may not be visible in the list.
 *
 * The same table also carries a check constraint on the role/access-role pair,
 * which is not a collision at all and must not be described as one, and every
 * rejected write leaves a Postgres error worth keeping in the request log —
 * both handled at the bottom of this file.
 */

/** The unique column behind a rejected write. */
export type EmployeeConflictField = "employee_id" | "email";

/** The employee already holding the value, as far as an administrator needs it. */
export interface EmployeeConflictHolder {
  fullName: string;
  /** `true` once `deleted_at` is set: the row still holds the value but is hidden everywhere. */
  removed: boolean;
  inactive: boolean;
}

interface DatabaseError {
  code?: string | null;
  message?: string | null;
  details?: string | null;
}

const uniqueViolation = "23505";
/** On `public.users` the only check constraint is the role/access-role pair. */
const checkViolation = "23514";
const duplicateWording = /duplicate key|already exists/i;

/**
 * PostgREST carries the SQLSTATE through, which is what this reads. The wording
 * is accepted as well so that a conflict is still recognised as one if a client
 * ever hands back a message without the code — the alternative is reporting a
 * plain duplicate as a server fault.
 */
export function isUniqueViolation(error: DatabaseError | null | undefined) {
  if (!error) return false;
  return (
    error.code === uniqueViolation ||
    duplicateWording.test(`${error.message ?? ""} ${error.details ?? ""}`)
  );
}

/**
 * Which column a unique violation was raised for, or `null` when the error was
 * something else entirely — a dropped connection, a rejected enum, a policy.
 * Postgres names the constraint in the message (`users_employee_id_key`), which
 * is the only place the column appears.
 */
export function uniqueViolationField(
  error: DatabaseError | null | undefined,
): EmployeeConflictField | null {
  if (!isUniqueViolation(error)) return null;
  const text = `${error?.message ?? ""} ${error?.details ?? ""}`.toLowerCase();
  if (text.includes("employee_id")) return "employee_id";
  if (text.includes("email")) return "email";
  return null;
}

/**
 * What to show the administrator. `holder` is omitted when the conflicting row
 * could not be read back, which is worth saying plainly rather than guessing.
 */
export function employeeConflictMessage(
  field: EmployeeConflictField,
  value: string,
  holder?: EmployeeConflictHolder | null,
): string {
  const subject =
    field === "employee_id"
      ? `Employee ID “${value}”`
      : `The email address ${value}`;
  const alternative =
    field === "employee_id"
      ? "Give this employee a different Employee ID."
      : "Every employee needs their own email address, so use a different one.";
  if (!holder) return `${subject} is already in use. ${alternative}`;
  if (holder.removed)
    return `${subject} still belongs to a removed record for ${holder.fullName}, which is why it does not appear in the employee list. ${alternative}`;
  if (holder.inactive)
    return `${subject} is already used by ${holder.fullName}, whose profile is inactive. If this is the same person returning, reactivate that profile instead of creating a second one. Otherwise ${alternative.charAt(0).toLowerCase()}${alternative.slice(1)}`;
  return `${subject} is already used by ${holder.fullName}. ${alternative}`;
}

/**
 * A literal value made safe to hand to a `LIKE`/`ILIKE` pattern. Emails may
 * legally contain `_`, which would otherwise match any single character and
 * report a collision with an address nobody typed.
 */
export function escapeLikePattern(value: string) {
  return value.replace(/[\\%_]/g, (character) => `\\${character}`);
}

/**
 * Whether the write was refused because the operational role and the access
 * role cannot go together.
 *
 * Reported separately because it is not a duplicate: nothing already holds
 * these details, and telling an administrator otherwise sends them hunting for
 * a employee who does not exist.
 */
export function isIncompatibleRole(error: DatabaseError | null | undefined) {
  return error?.code === checkViolation;
}

/**
 * The parts of a Postgres error worth keeping in the request log.
 *
 * The client-facing message is deliberately broad for anything that is not a
 * named collision, so without this a reported reference ID leads to a log entry
 * that says no more than the administrator already saw. The logger redacts
 * email addresses inside these strings; what survives is the constraint and the
 * non-sensitive key that collided.
 */
export function writeErrorDetail(
  error: DatabaseError,
): Record<string, unknown> {
  return {
    pgCode: error.code ?? null,
    pgMessage: error.message ?? null,
    pgDetails: error.details ?? null,
  };
}

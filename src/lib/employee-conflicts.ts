/**
 * Turns a Postgres write failure on `public.users` into something an
 * administrator can act on.
 *
 * The employee table is unique on `employee_id` and on `email`, and both
 * constraints are held by soft-deleted rows too. Reporting every rejected write
 * as "an employee with those details already exists" left administrators
 * staring at a form whose visible details — name, email, phone — really were
 * unique, with nothing pointing at the field that actually collided.
 */

/** Postgres unique violation. */
const UNIQUE_VIOLATION = "23505";
/** Postgres check violation — on this table, only the role/access-role pair. */
const CHECK_VIOLATION = "23514";

export interface PostgresWriteError {
  code?: string | null;
  message?: string | null;
  details?: string | null;
}

export interface EmployeeWriteFailure {
  code: string;
  message: string;
  status: number;
}

/**
 * Which column the violation names. Postgres reports both the constraint
 * (`users_employee_id_key`) and the offending key (`Key (employee_id)=(...)`),
 * so matching the column name covers either wording. `employee_id` is tested
 * first because it is the more specific of the two.
 */
function names(error: PostgresWriteError, column: string): boolean {
  return `${error.message ?? ""} ${error.details ?? ""}`.includes(column);
}

/**
 * Returns the failure to report, or `null` when the error is not one this
 * table's constraints explain — the caller then decides how to describe an
 * unexpected database failure.
 */
export function employeeWriteFailure(
  error: PostgresWriteError | null | undefined,
  values: { employeeId?: string } = {},
): EmployeeWriteFailure | null {
  if (!error) return null;
  if (error.code === UNIQUE_VIOLATION) {
    if (names(error, "employee_id"))
      return {
        code: "employee_id_taken",
        status: 409,
        message: `${
          values.employeeId
            ? `Employee ID "${values.employeeId}" is`
            : "That Employee ID is"
        } already assigned to another employee. Employee IDs must be unique, and an employee who was removed still holds theirs.`,
      };
    if (names(error, "email"))
      return {
        code: "email_taken",
        status: 409,
        message:
          "That email address is already assigned to another employee. An employee who was removed still holds theirs.",
      };
    return {
      code: "employee_conflict",
      status: 409,
      message: "An employee with those details already exists.",
    };
  }
  if (error.code === CHECK_VIOLATION)
    return {
      code: "incompatible_role",
      status: 400,
      message: "Operational role and access role are incompatible.",
    };
  return null;
}

/**
 * The parts of a Postgres error worth keeping in the request log. The logger
 * redacts email addresses inside these strings; what survives is the constraint
 * and the non-sensitive key that collided, which is what makes a reported
 * reference ID answerable.
 */
export function writeErrorDetail(
  error: PostgresWriteError,
): Record<string, unknown> {
  return {
    pgCode: error.code ?? null,
    pgMessage: error.message ?? null,
    pgDetails: error.details ?? null,
  };
}

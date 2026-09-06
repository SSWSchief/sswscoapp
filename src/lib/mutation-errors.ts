/**
 * What to tell somebody whose change did not save.
 *
 * Every browser mutation funnels through `failure()` in the operations
 * provider, which until now put whatever the database said into a toast. That
 * is fine for the messages this schema raises on purpose — they are written for
 * people, and the invoice, time-clock and job functions all rely on it — but
 * everything else Postgres says is written for whoever wrote the query:
 * dispatch adding a container on a code already in the yard read "duplicate key
 * value violates unique constraint \"dumpsters_code_key\"", and a driver whose
 * session had gone stale read a row-level-security policy name.
 *
 * `raise exception` from plpgsql arrives as SQLSTATE P0001, so the messages
 * this schema wrote for people are exactly the ones that can be passed through
 * unchanged. Everything else is translated here, once, on the way to the toast.
 * The original code is kept on the result so logs and future triage still have
 * the real cause.
 *
 * The API routes solve the same problem on the server for invoices; see
 * `invoiceWriteError` in `@/lib/invoices/api`.
 */

interface DatabaseError {
  code?: string | null;
  message?: string | null;
  details?: string | null;
  hint?: string | null;
}

/** SQLSTATEs whose message this schema wrote deliberately, for a person to read. */
const RAISED_BY_US = new Set(["P0001"]);

/**
 * A SQLSTATE, which is what marks an error as the database's own words rather
 * than ours. Messages that reach here carrying anything else — the API routes'
 * own vocabulary, a message the provider wrote itself — were already written
 * for a person and are left exactly as they are.
 */
const SQLSTATE = /^[0-9A-Z]{5}$/;
const isDatabaseCode = (code: string | undefined) =>
  Boolean(code) && (SQLSTATE.test(code as string) || (code as string).startsWith("PGRST"));

/**
 * Unique constraints a person can collide with by doing their job, and what to
 * say about each. Anything not named here still gets a plain sentence.
 */
const UNIQUE_CONSTRAINTS: { fragment: string; message: string }[] = [
  { fragment: "dumpsters_code", message: "A dumpster already has that code. Give this one a different code." },
  { fragment: "trucks_number", message: "A truck already has that number. Give this one a different number." },
  { fragment: "users_employee_id", message: "That Employee ID already belongs to someone else, including profiles that were removed. Use a different one." },
  { fragment: "users_email", message: "That email address already belongs to another employee. Every employee needs their own." },
  { fragment: "vendors_name", message: "A vendor is already saved under that name." },
  { fragment: "invoice_number", message: "That invoice number is already taken. Reopen the invoice list and try again." },
  { fragment: "invoice_jobs", message: "That job is already on another invoice." },
  { fragment: "jobs_reference", message: "That job number is already taken. Reopen the job list and try again." },
];

const FALLBACK =
  "That change could not be saved. Try again, and tell the office if it keeps happening.";
const NO_PERMISSION =
  "You do not have permission to make that change. Ask an administrator if you should.";
const SESSION_EXPIRED = "Your session has expired. Sign in again, then retry.";

function uniqueViolationMessage(text: string) {
  const named = UNIQUE_CONSTRAINTS.find((candidate) =>
    text.includes(candidate.fragment),
  );
  return (
    named?.message ??
    "Something with those details already exists, so this would be a duplicate."
  );
}

/** The translation for a SQLSTATE the database raised itself. */
function databaseMessage(code: string, text: string) {
  switch (code) {
    case "23505":
      return uniqueViolationMessage(text);
    case "23503":
      return "That record is still attached to other work, so it cannot be removed. Detach it first.";
    case "23502":
      return "Something required was left blank. Fill in every required field and save again.";
    case "23514":
      return "Those details are not a combination this system accepts. Check the fields and try again.";
    case "22P02":
    case "22007":
    case "22003":
      return "One of those values is not in a format the system can read. Check the numbers and dates.";
    case "42501":
      return NO_PERMISSION;
    case "PGRST301":
    case "PGRST302":
      return SESSION_EXPIRED;
    default:
      return FALLBACK;
  }
}

/**
 * A message safe to show, and the code worth keeping.
 *
 * `code` is the original, unchanged: it is what a reported problem is
 * eventually traced by, and nothing user-facing is derived from it beyond the
 * sentence chosen here.
 */
export function mutationErrorMessage(error: unknown): {
  code: string;
  message: string;
} {
  const candidate = (error ?? {}) as DatabaseError;
  const code = candidate.code ?? undefined;
  const raw = (candidate.message ?? "").trim();
  const text = `${raw} ${candidate.details ?? ""}`.toLowerCase();

  // Row level security and an expired session can arrive without a SQLSTATE
  // through some clients, and a dropped connection in the cab never has one, so
  // these three are read from the wording before anything else is decided.
  if (text.includes("row-level security") || text.includes("row level security"))
    return { code: code ?? "forbidden", message: NO_PERMISSION };
  if (text.includes("jwt expired") || text.includes("jwt is expired"))
    return { code: code ?? "unauthorized", message: SESSION_EXPIRED };
  if (
    text.includes("failed to fetch") ||
    text.includes("networkerror") ||
    text.includes("network request failed") ||
    text.includes("load failed")
  )
    return {
      code: code ?? "offline",
      message: "The connection dropped before that could be saved. Check your signal and try again.",
    };

  if (code && RAISED_BY_US.has(code) && raw) return { code, message: raw };
  if (isDatabaseCode(code))
    return { code: code as string, message: databaseMessage(code as string, text) };
  // Not the database talking: the API routes and the providers write their own
  // messages for people, and those are already the right words.
  if (raw) return { code: code ?? "unexpected_error", message: raw };
  return { code: code ?? "unexpected_error", message: FALLBACK };
}

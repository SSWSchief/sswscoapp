/**
 * A stand-in for the Supabase admin client, good enough for the route tests.
 *
 * The routes it serves are the ones that decide what an administrator is told
 * when a write is rejected, so the parts that matter here are the filters and
 * the errors: `ilike` honours `LIKE` escaping the way Postgres does, and an
 * insert or update can be made to fail with any Postgres error code.
 */

export type Row = Record<string, unknown>;
export type Tables = Record<string, Row[]>;
export interface DatabaseFailure {
  code: string;
  message: string;
  details?: string;
}

interface Options {
  /** Rejects the next insert, as Postgres would. */
  insertError?: DatabaseFailure;
  /** Rejects the next update. */
  updateError?: DatabaseFailure;
  /** Rejects reads of this table, standing in for an unreachable database. */
  selectError?: DatabaseFailure;
}

type Filter = ["eq" | "neq" | "ilike" | "is", string, unknown];

/** A `LIKE` pattern as Postgres reads it: `%` and `_` are wildcards unless escaped. */
function likeMatcher(pattern: string) {
  let source = "";
  for (let index = 0; index < pattern.length; index += 1) {
    const character = pattern[index];
    if (character === "\\") {
      index += 1;
      source += pattern[index]?.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") ?? "";
      continue;
    }
    if (character === "%") source += ".*";
    else if (character === "_") source += ".";
    else source += character.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
  return new RegExp(`^${source}$`, "i");
}

function matches(row: Row, filters: Filter[]) {
  return filters.every(([operator, column, value]) => {
    const actual = row[column];
    if (operator === "eq") return actual === value;
    if (operator === "neq") return actual !== value;
    if (operator === "is") return actual === value;
    return typeof actual === "string" && likeMatcher(String(value)).test(actual);
  });
}

export function fakeAdminClient(tables: Tables, options: Options = {}) {
  const store: Tables = Object.fromEntries(
    Object.entries(tables).map(([name, rows]) => [name, rows.map((r) => ({ ...r }))]),
  );
  const inserted: Row[] = [];
  const from = (table: string) => {
    const filters: Filter[] = [];
    let operation: "select" | "insert" | "update" | "delete" = "select";
    let payload: Row = {};
    const rows = () => (store[table] ??= []);
    const settle = () => {
      if (operation === "insert") {
        if (options.insertError) return { data: null, error: options.insertError };
        const row = { id: `generated-${rows().length + 1}`, ...payload };
        rows().push(row);
        inserted.push(row);
        return { data: row, error: null };
      }
      if (operation === "update") {
        if (options.updateError) return { data: null, error: options.updateError };
        const target = rows().find((row) => matches(row, filters));
        if (target) Object.assign(target, payload);
        return { data: target ?? null, error: null };
      }
      if (operation === "delete") {
        store[table] = rows().filter((row) => !matches(row, filters));
        return { data: null, error: null };
      }
      if (options.selectError) return { data: null, error: options.selectError };
      return { data: rows().filter((row) => matches(row, filters)), error: null };
    };
    const one = () => {
      const result = settle();
      if (result.error) return result;
      const data = Array.isArray(result.data) ? (result.data[0] ?? null) : result.data;
      return { data, error: null };
    };
    const chain = {
      select: () => chain,
      insert: (values: Row) => ((operation = "insert"), (payload = values), chain),
      update: (values: Row) => ((operation = "update"), (payload = values), chain),
      delete: () => ((operation = "delete"), chain),
      eq: (column: string, value: unknown) => (filters.push(["eq", column, value]), chain),
      neq: (column: string, value: unknown) => (filters.push(["neq", column, value]), chain),
      is: (column: string, value: unknown) => (filters.push(["is", column, value]), chain),
      ilike: (column: string, value: unknown) => (filters.push(["ilike", column, value]), chain),
      limit: () => chain,
      order: () => chain,
      maybeSingle: async () => one(),
      single: async () => one(),
      then: (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) =>
        Promise.resolve(settle()).then(resolve, reject),
    };
    return chain;
  };
  return {
    /** Every row this client actually wrote, for asserting nothing was created. */
    inserted,
    tables: store,
    client: {
      from,
      rpc: async (name: string) => ({
        data: name === "consume_api_rate_limit" ? true : null,
        error: null,
      }),
      auth: {
        resetPasswordForEmail: async () => ({ data: {}, error: null }),
        admin: {
          listUsers: async () => ({ data: { users: [] }, error: null }),
          createUser: async () => ({ data: { user: { id: "auth-new" } }, error: null }),
          updateUserById: async () => ({ data: { user: { id: "auth-new" } }, error: null }),
          inviteUserByEmail: async () => ({ data: {}, error: null }),
        },
      },
    },
  };
}

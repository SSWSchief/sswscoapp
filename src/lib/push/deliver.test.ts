import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

const sent = vi.hoisted(() => vi.fn());
vi.mock("./send", () => ({ sendPushToSubscriptions: sent }));
vi.mock("./env", () => ({ getPushEnv: () => ({ publicKey: "p", privateKey: "k", subject: "mailto:a@b" }) }));

const { deliverPendingNotifications } = await import("./deliver");

type Row = Record<string, unknown>;

/**
 * Just enough of the admin client for this pass: the `notifications` table is
 * real state, so a claimed row genuinely stops being claimable — which is the
 * behaviour these tests exist to prove.
 */
function fakeAdmin(state: {
  notifications: Row[];
  users: Row[];
  subscriptions: Row[];
}) {
  const deleted: string[] = [];
  const client = {
    from(table: string) {
      const chain = {
        rows: [] as Row[],
        select() {
          return chain;
        },
        is(column: string, value: unknown) {
          chain.rows = chain.rows.filter((row) => (row[column] ?? null) === value);
          return chain;
        },
        gte(column: string, value: string) {
          chain.rows = chain.rows.filter(
            (row) => String(row[column]) >= value,
          );
          return chain;
        },
        in(column: string, values: unknown[]) {
          chain.rows = chain.rows.filter((row) => values.includes(row[column]));
          return chain;
        },
        order() {
          return chain;
        },
        limit(count: number) {
          chain.rows = chain.rows.slice(0, count);
          return Promise.resolve({ data: chain.rows, error: null });
        },
        update(patch: Row) {
          const target = chain.rows;
          return {
            in: (column: string, values: unknown[]) => ({
              is: (isColumn: string, isValue: unknown) => ({
                select: () => {
                  const changed = target.filter(
                    (row) =>
                      values.includes(row[column]) &&
                      (row[isColumn] ?? null) === isValue,
                  );
                  for (const row of changed) Object.assign(row, patch);
                  return Promise.resolve({ data: changed, error: null });
                },
              }),
            }),
          };
        },
        delete() {
          return {
            in: (column: string, values: unknown[]) => {
              deleted.push(...(values as string[]));
              return Promise.resolve({ data: null, error: null });
            },
          };
        },
        then(resolve: (value: { data: Row[]; error: null }) => unknown) {
          return Promise.resolve({ data: chain.rows, error: null }).then(resolve);
        },
      };
      chain.rows =
        table === "notifications"
          ? state.notifications
          : table === "users"
            ? state.users
            : state.subscriptions;
      return chain;
    },
  };
  return { client: client as unknown as SupabaseClient<Database>, deleted };
}

const notification = (overrides: Row = {}): Row => ({
  id: "n-1",
  recipient_user_id: "driver-1",
  source_role: "dispatcher",
  category: "job_assignment",
  title: "New job assigned: J-1001",
  body: "Delivery at 1 Main St. Please acknowledge this assignment.",
  related_job_id: "job-1",
  requires_acknowledgement: true,
  acknowledged_at: null,
  pushed_at: null,
  created_at: new Date().toISOString(),
  ...overrides,
});

const state = () => ({
  notifications: [notification()],
  users: [{ id: "driver-1", access_role: "driver" }],
  subscriptions: [
    {
      id: "sub-1",
      user_id: "driver-1",
      endpoint: "https://push.test/1",
      p256dh: "key",
      auth: "auth",
    },
  ],
});

beforeEach(() => {
  sent.mockReset();
  sent.mockResolvedValue({ sent: 1, staleIds: [] });
});

describe("deliverPendingNotifications", () => {
  it("pushes a job assignment to the driver's device, deep-linked to the job", async () => {
    const { client } = fakeAdmin(state());
    const result = await deliverPendingNotifications(client);
    expect(result).toMatchObject({ claimed: 1, sent: 1, skipped: 0 });
    const [targets, payload] = sent.mock.calls[0];
    expect(targets).toHaveLength(1);
    expect(payload.title).toBe("New job assigned: J-1001");
    expect(payload.data.url).toBe("/driver/jobs/job-1");
  });

  it("sends each notification once, however many passes run", async () => {
    // Two dispatchers acting at the same moment both trigger a pass. The
    // second finds the row already claimed and has nothing to send — the
    // driver's phone buzzes once, not twice.
    const shared = state();
    const first = fakeAdmin(shared);
    const second = fakeAdmin(shared);
    await deliverPendingNotifications(first.client);
    const again = await deliverPendingNotifications(second.client);
    expect(again).toMatchObject({ claimed: 0, sent: 0 });
    expect(sent).toHaveBeenCalledTimes(1);
  });

  it("marks a stale notification delivered instead of alerting about it late", async () => {
    const shared = state();
    shared.notifications = [
      notification({
        created_at: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
      }),
    ];
    const { client } = fakeAdmin(shared);
    const result = await deliverPendingNotifications(client);
    expect(result).toMatchObject({ claimed: 1, sent: 0, skipped: 1 });
    expect(sent).not.toHaveBeenCalled();
    expect(shared.notifications[0].pushed_at).not.toBeNull();
  });

  it("does nothing when the recipient has no device registered", async () => {
    const shared = state();
    shared.subscriptions = [];
    const { client } = fakeAdmin(shared);
    const result = await deliverPendingNotifications(client);
    expect(result).toMatchObject({ claimed: 1, sent: 0 });
    expect(sent).not.toHaveBeenCalled();
  });

  it("drops subscriptions the push service has retired", async () => {
    sent.mockResolvedValue({ sent: 0, staleIds: ["sub-1"] });
    const { client, deleted } = fakeAdmin(state());
    const result = await deliverPendingNotifications(client);
    expect(result.pruned).toBe(1);
    expect(deleted).toEqual(["sub-1"]);
  });

  it("sends staff to the dispatch view of the same job", async () => {
    const shared = state();
    shared.notifications = [
      notification({ id: "n-2", recipient_user_id: "dispatch-1" }),
    ];
    shared.users = [{ id: "dispatch-1", access_role: "dispatcher" }];
    shared.subscriptions = [
      {
        id: "sub-2",
        user_id: "dispatch-1",
        endpoint: "https://push.test/2",
        p256dh: "key",
        auth: "auth",
      },
    ];
    const { client } = fakeAdmin(shared);
    await deliverPendingNotifications(client);
    expect(sent.mock.calls[0][1].data.url).toBe("/dispatcher/jobs/job-1");
  });
});

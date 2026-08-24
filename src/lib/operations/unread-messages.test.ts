import { describe, expect, it } from "vitest";
import type { MessageChannel, TeamMessage } from "@/lib/types";
import { groupUnreadByChannel, unreadMessagesFor } from "./unread-messages";

const channels: MessageChannel[] = [
  { id: "c1", name: "Austin Marshall", kind: "direct" },
  { id: "c2", name: "Dispatch", kind: "group" },
] as MessageChannel[];

const message = (over: Partial<TeamMessage>): TeamMessage => ({
  id: "m",
  channelId: "c1",
  senderId: "other",
  body: "Test",
  createdAt: "2026-08-24T10:00:00.000Z",
  read: false,
  ...over,
});

describe("unreadMessagesFor", () => {
  it("counts unread messages from other people", () => {
    const result = unreadMessagesFor([message({ id: "a" })], channels, "me");
    expect(result).toHaveLength(1);
  });

  it("ignores your own messages and ones already read", () => {
    const result = unreadMessagesFor(
      [
        message({ id: "a", senderId: "me" }),
        message({ id: "b", read: true }),
        message({ id: "c" }),
      ],
      channels,
      "me",
    );
    expect(result.map((m) => m.id)).toEqual(["c"]);
  });

  // The production bug: four unread messages in a conversation the user had
  // deleted kept the badge lit, and the bell's only entry was an unnamed
  // "Conversation" that opened an empty pane.
  it("ignores messages left behind by a conversation you deleted", () => {
    const result = unreadMessagesFor(
      [message({ id: "a" }), message({ id: "orphan", channelId: "gone" })],
      channels,
      "me",
    );
    expect(result.map((m) => m.id)).toEqual(["a"]);
  });

  it("counts nothing when every channel has been left", () => {
    const result = unreadMessagesFor(
      [message({ id: "orphan", channelId: "gone" })],
      [],
      "me",
    );
    expect(result).toEqual([]);
  });
});

describe("groupUnreadByChannel", () => {
  it("groups per conversation and names it from the channel", () => {
    const unread = [
      message({ id: "a", createdAt: "2026-08-24T10:00:00.000Z" }),
      message({
        id: "b",
        body: "Newer",
        createdAt: "2026-08-24T11:00:00.000Z",
      }),
      message({ id: "c", channelId: "c2", body: "Dispatch note" }),
    ];
    const result = groupUnreadByChannel(unread, channels);
    const austin = result.find((entry) => entry.id === "c1");
    expect(austin).toMatchObject({
      name: "Austin Marshall",
      unread: 2,
      lastBody: "Newer",
    });
    expect(result.find((entry) => entry.id === "c2")?.unread).toBe(1);
  });

  it("orders the most recently active conversation first", () => {
    const result = groupUnreadByChannel(
      [
        message({ id: "a", createdAt: "2026-08-24T08:00:00.000Z" }),
        message({
          id: "b",
          channelId: "c2",
          createdAt: "2026-08-24T12:00:00.000Z",
        }),
      ],
      channels,
    );
    expect(result.map((entry) => entry.id)).toEqual(["c2", "c1"]);
  });
});

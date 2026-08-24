import * as React from "react";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TeamMessages } from "./TeamMessages";

const mocks = vi.hoisted(() => ({
  expanded: vi.fn(),
  operations: vi.fn(),
  toast: vi.fn(),
  confirm: vi.fn(),
  searchParams: new URLSearchParams(),
}));
vi.mock("./ExpandedOperationsProvider", () => ({
  useExpandedOperations: mocks.expanded,
}));
vi.mock("./OperationsProvider", () => ({ useOperations: mocks.operations }));
vi.mock("./ToastProvider", () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock("./ConfirmProvider", () => ({ useConfirm: () => mocks.confirm }));
vi.mock("next/navigation", () => ({
  useSearchParams: () => mocks.searchParams,
}));

const channels = [
  { id: "c1", name: "Alexus Marshall", kind: "direct" as const },
  { id: "c2", name: "Company", kind: "announcement" as const },
];
const messages = [
  {
    id: "m1",
    channelId: "c1",
    senderId: "other",
    body: "Test",
    createdAt: "2026-08-24T10:00:00.000Z",
    read: false,
  },
  {
    id: "m2",
    channelId: "c1",
    senderId: "me",
    body: "Reply",
    createdAt: "2026-08-24T10:01:00.000Z",
    read: true,
  },
];

const deleteChannel = vi.fn();
const markChannelRead = vi.fn();

describe("TeamMessages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.searchParams = new URLSearchParams();
    deleteChannel.mockResolvedValue({ ok: true, data: undefined });
    markChannelRead.mockResolvedValue({ ok: true, data: undefined });
    mocks.operations.mockReturnValue({
      users: [{ id: "other", fullName: "Alexus Marshall" }],
      currentUser: { id: "me", accessRole: "admin" },
      canMutate: true,
    });
    mocks.expanded.mockReturnValue({
      channels,
      messages,
      messageRecipients: [{ id: "other", fullName: "Alexus Marshall" }],
      sendMessage: vi.fn(),
      createDirectChannel: vi.fn(),
      deleteChannel,
      markChannelRead,
      loadReadReceipts: vi.fn(),
    });
  });

  afterEach(() => cleanup());

  // Austin reported "no way to scroll". Both panes must own a bounded,
  // scrollable region rather than growing the page until it overflows.
  it("keeps the conversation list and the thread independently scrollable", () => {
    const { container } = render(<TeamMessages />);
    const scrollers = container.querySelectorAll(".overflow-y-auto");
    expect(scrollers.length).toBeGreaterThan(0);
    scrollers.forEach((element) => {
      expect(element.className).toContain("min-h-0");
      expect(element.className).toContain("flex-1");
    });
  });

  // Austin reported "no way to delete chats".
  it("offers a delete control on direct conversations and confirms first", async () => {
    mocks.confirm.mockResolvedValue(true);
    render(<TeamMessages />);
    const remove = screen.getByRole("button", {
      name: "Delete conversation with Alexus Marshall",
    });
    await userEvent.click(remove);
    expect(mocks.confirm).toHaveBeenCalledOnce();
    expect(deleteChannel).toHaveBeenCalledWith("c1");
  });

  it("keeps the conversation when the confirmation is declined", async () => {
    mocks.confirm.mockResolvedValue(false);
    render(<TeamMessages />);
    await userEvent.click(
      screen.getByRole("button", {
        name: "Delete conversation with Alexus Marshall",
      }),
    );
    expect(deleteChannel).not.toHaveBeenCalled();
  });

  it("does not offer to delete the read-only announcement channel", () => {
    render(<TeamMessages />);
    expect(
      screen.queryByRole("button", { name: /Delete conversation with Company/ }),
    ).not.toBeInTheDocument();
  });

  // On a phone the list and the thread share the screen, so opening a
  // conversation has to leave a way back to the list.
  it("gives mobile a way back from a thread to the conversation list", async () => {
    render(<TeamMessages />);
    await userEvent.click(screen.getByRole("button", {
      name: "Open conversation with Alexus Marshall",
    }));
    expect(
      screen.getByRole("button", { name: "Back to conversations" }),
    ).toBeInTheDocument();
    expect(markChannelRead).toHaveBeenCalledWith("c1");
  });

  it("shows an unread count next to the sender", () => {
    render(<TeamMessages />);
    const row = screen.getByRole("button", {
      name: "Open conversation with Alexus Marshall",
    });
    expect(within(row).getByText("1")).toBeInTheDocument();
  });
});

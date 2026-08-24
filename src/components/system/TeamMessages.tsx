"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { useExpandedOperations } from "./ExpandedOperationsProvider";
import { useOperations } from "./OperationsProvider";
import { useToast } from "./ToastProvider";
import { useConfirm } from "./ConfirmProvider";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { Select, Textarea } from "@/components/ui/Field";
import { RelativeTime } from "@/components/ui/RelativeTime";

/**
 * "Seen by" for a message you sent. Loaded on demand rather than with the
 * channel: receipts are only meaningful for your own messages, and fetching
 * them for every message in a thread would be a query per message.
 */
function ReadReceipts({ messageId }: { messageId: string }) {
  const { loadReadReceipts } = useExpandedOperations();
  const [names, setNames] = React.useState<string[] | null>(null);
  const [open, setOpen] = React.useState(false);

  const reveal = async () => {
    setOpen(true);
    if (names) return;
    const result = await loadReadReceipts(messageId);
    setNames(result.ok ? result.data.map((entry) => entry.fullName) : []);
  };

  if (!open)
    return (
      <button
        type="button"
        onClick={() => void reveal()}
        className="underline underline-offset-2"
      >
        Seen by…
      </button>
    );
  if (!names) return <span>Checking…</span>;
  return (
    <span>
      {names.length
        ? `Seen by ${names.length}: ${names.join(", ")}`
        : "Not seen yet"}
    </span>
  );
}

function initials(name: string) {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase() || "?"
  );
}

export function TeamMessages() {
  const {
    channels,
    messages,
    messageRecipients,
    sendMessage,
    createDirectChannel,
    deleteChannel,
    markChannelRead,
  } = useExpandedOperations();
  const { users, currentUser, canMutate } = useOperations();
  const { toast } = useToast();
  const confirm = useConfirm();
  const searchParams = useSearchParams();
  const [channelId, setChannelId] = React.useState("");
  const [composeOpen, setComposeOpen] = React.useState(false);
  const [recipient, setRecipient] = React.useState("");
  const [draft, setDraft] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  // Only deep-links pick a channel automatically. Landing here with no
  // channel selected keeps mobile on the conversation list instead of
  // jumping straight into a thread (channelId also drives which of the two
  // panes is visible on narrow screens, see the className logic below).
  React.useEffect(() => {
    const fromUrl = searchParams.get("channel");
    if (fromUrl) setChannelId(fromUrl);
  }, [searchParams]);

  const channel = channels.find((item) => item.id === channelId);
  const rows = messages.filter((message) => message.channelId === channelId);

  const lastMessageByChannel = React.useMemo(() => {
    const map = new Map<string, (typeof messages)[number]>();
    for (const message of messages) {
      const existing = map.get(message.channelId);
      if (!existing || message.createdAt > existing.createdAt) {
        map.set(message.channelId, message);
      }
    }
    return map;
  }, [messages]);

  React.useEffect(() => {
    if (channelId) void markChannelRead(channelId);
  }, [channelId, markChannelRead]);

  const openChannel = (id: string) => {
    setChannelId(id);
    setComposeOpen(false);
  };

  const startDirect = async () => {
    if (!recipient) return;
    setBusy(true);
    const result = await createDirectChannel(recipient);
    setBusy(false);
    if (result.ok) {
      openChannel(result.data);
      setRecipient("");
    } else {
      toast(result.error.message, { tone: "error" });
    }
  };

  const send = async () => {
    if (!draft.trim() || busy) return;
    setBusy(true);
    const result = await sendMessage(channelId, draft);
    setBusy(false);
    toast(result.ok ? "Message sent" : result.error.message, {
      tone: result.ok ? "success" : "error",
    });
    if (result.ok) setDraft("");
  };

  const removeChannel = async (target: (typeof channels)[number]) => {
    const ok = await confirm({
      title: `Delete conversation with ${target.name}?`,
      message: "This removes it from your message list for good.",
      confirmLabel: "Delete",
      tone: "danger",
    });
    if (!ok) return;
    const result = await deleteChannel(target.id);
    if (result.ok) {
      if (target.id === channelId) setChannelId("");
    } else {
      toast(result.error.message, { tone: "error" });
    }
  };

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4 lg:grid lg:grid-cols-[280px_minmax(0,1fr)]">
      <Card
        className={`min-h-0 min-w-0 flex-col overflow-hidden lg:flex lg:self-stretch ${
          channelId ? "hidden lg:flex" : "flex"
        }`}
      >
        <CardHeader
          title="Channels"
          action={
            <button
              type="button"
              onClick={() => setComposeOpen((open) => !open)}
              aria-label={composeOpen ? "Close new message" : "New message"}
              aria-expanded={composeOpen}
              className={`inline-flex min-h-9 min-w-9 items-center justify-center rounded-full transition-colors ${
                composeOpen
                  ? "bg-brand-blue text-white"
                  : "bg-brand-mist text-brand-blue hover:bg-brand-ice/60"
              }`}
            >
              <Icon
                name="plus"
                width={18}
                height={18}
                className={`transition-transform ${composeOpen ? "rotate-45" : ""}`}
              />
            </button>
          }
        />
        {composeOpen && (
          <div className="space-y-2 border-b border-brand-ice p-3">
            <Select
              aria-label="Direct message recipient"
              value={recipient}
              onChange={(event) => setRecipient(event.target.value)}
            >
              <option value="">Choose a recipient…</option>
              {messageRecipients.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.fullName}
                </option>
              ))}
            </Select>
            <Button
              className="w-full"
              size="sm"
              disabled={!recipient || busy || !canMutate}
              onClick={() => void startDirect()}
            >
              Start message
            </Button>
          </div>
        )}
        <div className="min-h-0 flex-1 divide-y divide-brand-ice overflow-y-auto">
          {channels.map((item) => {
            const unread = messages.filter(
              (message) =>
                message.channelId === item.id &&
                !message.read &&
                message.senderId !== currentUser?.id,
            ).length;
            const last = lastMessageByChannel.get(item.id);
            const active = item.id === channelId;
            return (
              <div
                key={item.id}
                className={`group flex min-w-0 items-center gap-1 pr-1 ${
                  active ? "bg-brand-mist" : "hover:bg-brand-mist/60"
                }`}
              >
                <button
                  onClick={() => openChannel(item.id)}
                  aria-label={`Open conversation with ${item.name}`}
                  className="flex min-h-16 w-full min-w-0 flex-1 items-center gap-3 p-3 text-left"
                >
                  <span
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-heading text-sm font-semibold ${
                      active
                        ? "bg-brand-blue text-white"
                        : "bg-brand-navy/10 text-brand-navy"
                    }`}
                  >
                    {initials(item.name)}
                  </span>
                  <span className="min-w-0 flex-1 space-y-0.5">
                    <span className="flex items-center justify-between gap-2">
                      <span
                        className={`truncate text-sm font-semibold ${
                          active ? "text-brand-blue" : "text-brand-charcoal"
                        }`}
                      >
                        {item.name}
                      </span>
                      {last && (
                        <span className="shrink-0 text-[11px] text-brand-steel">
                          <RelativeTime iso={last.createdAt} />
                        </span>
                      )}
                    </span>
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate text-xs text-brand-steel">
                        {last ? last.body : "No messages yet"}
                      </span>
                      {unread > 0 && (
                        <span className="shrink-0 rounded-full bg-brand-blue px-1.5 py-0.5 text-[10px] font-semibold text-white">
                          {unread}
                        </span>
                      )}
                    </span>
                  </span>
                </button>
                {item.kind === "direct" && canMutate && (
                  <button
                    type="button"
                    aria-label={`Delete conversation with ${item.name}`}
                    onClick={() => void removeChannel(item)}
                    className="shrink-0 rounded p-2 text-brand-steel hover:text-red-600"
                  >
                    <Icon name="close" className="h-4 w-4" />
                  </button>
                )}
              </div>
            );
          })}
          {!channels.length && (
            <p className="p-4 text-sm text-brand-steel">
              No conversations yet. Tap + to start one.
            </p>
          )}
        </div>
      </Card>

      <Card
        className={`min-h-0 min-w-0 flex-1 flex-col overflow-hidden lg:flex lg:min-h-[480px] ${
          channelId ? "flex" : "hidden lg:flex"
        }`}
      >
        {channel ? (
          <>
            <div className="flex items-center gap-1 border-b border-brand-ice/50 px-3 py-3 dark:border-white/10 sm:px-5">
              <button
                type="button"
                onClick={() => setChannelId("")}
                aria-label="Back to conversations"
                className="-ml-1 inline-flex min-h-9 min-w-9 items-center justify-center text-brand-steel lg:hidden"
              >
                <Icon name="chevron-right" className="rotate-180" />
              </button>
              <h2 className="min-w-0 flex-1 truncate font-heading text-base font-semibold uppercase tracking-wide text-brand-charcoal dark:text-white">
                {channel.name}
              </h2>
            </div>
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
              {rows.map((message) => (
                <div
                  key={message.id}
                  className={`max-w-[85%] break-words rounded p-3 [overflow-wrap:anywhere] ${
                    message.senderId === currentUser?.id
                      ? "ml-auto bg-brand-blue text-white"
                      : "bg-brand-mist"
                  }`}
                >
                  <div className="text-xs font-semibold">
                    {users.find((user) => user.id === message.senderId)
                      ?.fullName ??
                      messageRecipients.find(
                        (user) => user.id === message.senderId,
                      )?.fullName ??
                      "Employee"}
                  </div>
                  <p className="whitespace-pre-wrap text-sm">
                    {message.body}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] opacity-70">
                    <RelativeTime iso={message.createdAt} />
                    {message.senderId === currentUser?.id && (
                      <ReadReceipts messageId={message.id} />
                    )}
                  </div>
                </div>
              ))}
              {!rows.length && (
                <p className="text-sm text-brand-steel">
                  No messages in this channel.
                </p>
              )}
            </div>

            {channel.kind !== "announcement" ||
            currentUser?.accessRole === "admin" ? (
              <div className="border-t border-brand-ice p-3">
                <Textarea
                  aria-label="Message"
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  placeholder="Write a message…"
                />
                <Button
                  className="mt-2 w-full"
                  disabled={!canMutate || busy || !draft.trim()}
                  onClick={() => void send()}
                >
                  {busy ? "Sending…" : "Send"}
                </Button>
              </div>
            ) : (
              <p className="border-t border-brand-ice p-3 text-center text-xs text-brand-steel">
                Company announcements are read-only.
              </p>
            )}
          </>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center text-brand-steel">
            <Icon name="messages" width={32} height={32} />
            <p className="text-sm">Select a conversation to view messages.</p>
          </div>
        )}
      </Card>
    </div>
  );
}

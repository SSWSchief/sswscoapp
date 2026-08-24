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
  const [recipient, setRecipient] = React.useState("");
  const [draft, setDraft] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (channelId) return;
    const fromUrl = searchParams.get("channel");
    if (fromUrl) {
      setChannelId(fromUrl);
      return;
    }
    if (channels[0]) setChannelId(channels[0].id);
  }, [channelId, channels, searchParams]);

  const channel = channels.find((item) => item.id === channelId);
  const rows = messages.filter((message) => message.channelId === channelId);

  React.useEffect(() => {
    if (channelId) void markChannelRead(channelId);
  }, [channelId, markChannelRead]);

  const startDirect = async () => {
    if (!recipient) return;
    setBusy(true);
    const result = await createDirectChannel(recipient);
    setBusy(false);
    if (result.ok) {
      setChannelId(result.data);
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
    <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4 lg:grid lg:grid-cols-[260px_minmax(0,1fr)]">
      <Card className="flex max-h-56 min-w-0 flex-col overflow-hidden lg:max-h-none lg:self-start">
        <CardHeader title="Channels" />
        <div className="space-y-2 border-b border-brand-ice p-3">
          <Select
            aria-label="Direct message recipient"
            value={recipient}
            onChange={(event) => setRecipient(event.target.value)}
          >
            <option value="">New direct message…</option>
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
        <div className="min-h-0 flex-1 divide-y divide-brand-ice overflow-y-auto lg:flex-none lg:overflow-visible">
          {channels.map((item) => {
            const unread = messages.filter(
              (message) =>
                message.channelId === item.id &&
                !message.read &&
                message.senderId !== currentUser?.id,
            ).length;
            return (
              <div
                key={item.id}
                className={`flex min-h-12 min-w-0 items-center gap-2 pr-2 ${
                  item.id === channelId ? "bg-brand-mist text-brand-blue" : ""
                }`}
              >
                <button
                  onClick={() => setChannelId(item.id)}
                  className="flex min-h-12 w-full min-w-0 flex-1 items-center justify-between gap-3 p-3 text-left"
                >
                  <span className="min-w-0 break-words">{item.name}</span>
                  {unread > 0 && (
                    <span className="shrink-0 rounded-full bg-brand-blue px-2 py-0.5 text-xs text-white">
                      {unread}
                    </span>
                  )}
                </button>
                {item.kind === "direct" && canMutate && (
                  <button
                    type="button"
                    aria-label={`Delete conversation with ${item.name}`}
                    onClick={() => void removeChannel(item)}
                    className="shrink-0 rounded p-1.5 text-brand-steel hover:text-red-600"
                  >
                    <Icon name="close" className="h-4 w-4" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      <Card className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden lg:min-h-[480px] lg:flex-none">
        <CardHeader title={channel?.name ?? "Messages"} />
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
                {users.find((user) => user.id === message.senderId)?.fullName ??
                  messageRecipients.find((user) => user.id === message.senderId)
                    ?.fullName ??
                  "Employee"}
              </div>
              <p className="whitespace-pre-wrap text-sm">{message.body}</p>
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

        {channel?.kind !== "announcement" ||
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
      </Card>
    </div>
  );
}

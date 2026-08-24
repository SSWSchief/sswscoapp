import type { MessageChannel, TeamMessage } from "@/lib/types";

export interface UnreadChannel {
  id: string;
  name: string;
  unread: number;
  lastBody: string;
  lastAt: string;
}

/**
 * Messages that should raise a badge: unread, not your own, and belonging to a
 * channel you are still in.
 *
 * That last condition is the one with teeth. Messages outlive the membership
 * that made them visible — the delete control leaves a conversation rather than
 * destroying it — so without the channel check, a conversation you deleted goes
 * on contributing to the unread count forever, as an entry with no name that
 * opens nothing. Found against production data, not in review.
 */
export function unreadMessagesFor(
  messages: TeamMessage[],
  channels: MessageChannel[],
  currentUserId: string | undefined,
): TeamMessage[] {
  const known = new Set(channels.map((channel) => channel.id));
  return messages.filter(
    (message) =>
      !message.read &&
      message.senderId !== currentUserId &&
      known.has(message.channelId),
  );
}

/** The same messages grouped per conversation, most recently active first. */
export function groupUnreadByChannel(
  unread: TeamMessage[],
  channels: MessageChannel[],
): UnreadChannel[] {
  const nameById = new Map(
    channels.map((channel) => [channel.id, channel.name]),
  );
  const byChannel = new Map<string, UnreadChannel>();
  for (const message of unread) {
    const existing = byChannel.get(message.channelId);
    if (existing) {
      existing.unread += 1;
      if (message.createdAt > existing.lastAt) {
        existing.lastAt = message.createdAt;
        existing.lastBody = message.body;
      }
      continue;
    }
    byChannel.set(message.channelId, {
      id: message.channelId,
      name: nameById.get(message.channelId) ?? "Conversation",
      unread: 1,
      lastBody: message.body,
      lastAt: message.createdAt,
    });
  }
  return [...byChannel.values()].sort((a, b) => (a.lastAt < b.lastAt ? 1 : -1));
}

import { Topbar } from "@/components/dispatcher/Topbar";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/StatusBadge";
import { getMessageThreads } from "@/lib/data";
import { formatTime } from "@/lib/utils";

export default function DispatcherMessagesPage() {
  const threads = getMessageThreads();

  return (
    <>
      <Topbar title="Messages" />
      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="grid gap-5 lg:grid-cols-[280px_1fr]">
          <Card>
            <CardHeader title="Boards" />
            <div className="divide-y divide-brand-ice/50">
              {threads.map((thread) => (
                <div key={thread.id} className="p-4 hover:bg-brand-mist">
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-semibold text-brand-charcoal">{thread.channel}</div>
                    <Badge tone="blue" label={`${thread.messages.length}`} />
                  </div>
                  <p className="text-sm text-brand-steel mt-1">{thread.title}</p>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <CardHeader title="Instant Message Board" />
            <div className="divide-y divide-brand-ice/50">
              {threads.flatMap((thread) =>
                thread.messages.map((message) => (
                  <div key={message.id} className="p-5">
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                      <div className="break-words font-heading text-base font-semibold uppercase tracking-wide text-brand-charcoal">
                        {thread.channel} · {message.title}
                      </div>
                      <span className="text-xs text-brand-steel">{formatTime(message.createdAt)}</span>
                    </div>
                    <p className="text-sm text-brand-steel mt-2">{message.body}</p>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}

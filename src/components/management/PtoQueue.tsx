"use client";

import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { useOperations } from "@/components/system/OperationsProvider";
import { useToast } from "@/components/system/ToastProvider";
import { reviewBlockedReason } from "@/lib/time-clock";
import { formatDate } from "@/lib/utils";

/**
 * Pending PTO awaiting an owner's decision.
 *
 * PTO is management's to approve, and owners work out of this portal — without
 * a queue here the rule would mean telling a partner to go find the dispatch
 * portal to sign off on a day off.
 */
export function PtoQueue() {
  const { timeRequests, users, currentUser, reviewTimeRequest, canMutate } =
    useOperations();
  const { toast } = useToast();
  const pending = timeRequests.filter(
    (request) => request.kind === "pto" && request.status === "pending",
  );

  const decide = async (id: string, decision: "approved" | "denied") => {
    const result = await reviewTimeRequest(id, decision);
    toast(result.ok ? `PTO ${decision}` : result.error.message, {
      tone: result.ok ? "success" : "error",
    });
  };

  return (
    <Card>
      <CardHeader title="PTO Approvals" />
      {pending.length === 0 ? (
        <p className="p-5 text-sm text-brand-steel">
          No PTO requests are waiting.
        </p>
      ) : (
        <div className="divide-y divide-brand-ice/50">
          {pending.map((request) => {
            const author = users.find((user) => user.id === request.userId);
            const blocked = reviewBlockedReason(request, currentUser);
            return (
              <div
                key={request.id}
                className="flex flex-col items-start gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5"
              >
                <div className="min-w-0">
                  <div className="font-semibold text-brand-charcoal">
                    {author?.fullName ?? "Unknown employee"}
                  </div>
                  <div className="text-sm text-brand-steel">
                    {formatDate(request.requestedFor)} · {request.hours}h ·{" "}
                    {request.reason}
                  </div>
                </div>
                {blocked ? (
                  <span className="text-xs font-semibold uppercase tracking-wide text-brand-steel">
                    {blocked}
                  </span>
                ) : (
                  <div className="flex gap-2">
                    <Button
                      variant="secondary"
                      disabled={!canMutate}
                      onClick={() => void decide(request.id, "denied")}
                    >
                      Deny
                    </Button>
                    <Button
                      disabled={!canMutate}
                      onClick={() => void decide(request.id, "approved")}
                    >
                      Approve
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

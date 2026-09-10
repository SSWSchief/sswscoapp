"use client";

import * as React from "react";
import { Topbar } from "@/components/dispatcher/Topbar";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { FormField, Input } from "@/components/ui/Field";
import { useExpandedOperations } from "@/components/system/ExpandedOperationsProvider";
import { useOperations } from "@/components/system/OperationsProvider";
import { useToast } from "@/components/system/ToastProvider";
import type { PretripResult, PretripSubmission, PretripTemplate } from "@/lib/types";

const resultLabel: Record<PretripResult, string> = {
  pass: "Pass",
  fail: "Fail",
  na: "N/A",
};
const resultTone: Record<PretripResult, string> = {
  pass: "text-status-complete",
  fail: "font-semibold text-red-700",
  na: "text-brand-steel",
};

/** Awaiting a supervisor, worst first, then everything else newest first. */
function reviewOrder(a: PretripSubmission, b: PretripSubmission) {
  const pending = (s: PretripSubmission) =>
    !s.supervisorSignature.trim() && (s.hasFailures || s.safeToOperate === false);
  if (pending(a) !== pending(b)) return pending(a) ? -1 : 1;
  return b.submittedAt.localeCompare(a.submittedAt);
}

export default function PretripReviewPage() {
  const { pretripSubmissions, pretripTemplates, countersignPretrip, refresh } =
    useExpandedOperations();
  const { trucks, users, currentUser, canMutate } = useOperations();
  const { toast } = useToast();
  const [openId, setOpenId] = React.useState<string | null>(null);
  const [signature, setSignature] = React.useState("");
  const [busy, setBusy] = React.useState<string | null>(null);

  const ordered = [...pretripSubmissions].sort(reviewOrder);
  const awaiting = ordered.filter(
    (s) => !s.supervisorSignature.trim() && (s.hasFailures || s.safeToOperate === false),
  ).length;

  const countersign = async (submission: PretripSubmission) => {
    if (signature.trim().length < 2) {
      toast("Enter your name to counter-sign.", { tone: "error" });
      return;
    }
    setBusy(submission.id);
    const result = await countersignPretrip({
      submissionId: submission.id,
      signature,
    });
    setBusy(null);
    toast(result.ok ? "Inspection counter-signed." : result.error.message, {
      tone: result.ok ? "success" : "error",
    });
    if (result.ok) {
      setSignature("");
      setOpenId(null);
      await refresh();
    }
  };

  return (
    <>
      <Topbar title="Pre-Trip Review" />
      <div className="flex-1 overflow-y-auto bg-surface p-4 space-y-4">
        <Card className="p-4">
          <p className="text-sm text-brand-steel">
            {awaiting
              ? `${awaiting} inspection${awaiting === 1 ? "" : "s"} awaiting a supervisor signature.`
              : "Every failed inspection has been counter-signed."}
          </p>
        </Card>

        {!ordered.length ? (
          <EmptyState
            icon="clipboard"
            title="No inspections yet"
            message="Submitted pre-trip inspections appear here for review and sign-off."
          />
        ) : (
          <div className="space-y-3">
            {ordered.map((submission) => {
              const template = pretripTemplates.find((t) => t.id === submission.templateId);
              const truck = trucks.find((t) => t.id === submission.truckId);
              const driver = users.find((u) => u.id === submission.driverId);
              const signed = submission.supervisorSignature.trim();
              const unsafe = submission.safeToOperate === false;
              const expanded = openId === submission.id;
              return (
                <Card key={submission.id} className="overflow-hidden">
                  <button
                    className="flex w-full items-center justify-between gap-3 p-4 text-left"
                    aria-expanded={expanded}
                    onClick={() => {
                      setOpenId(expanded ? null : submission.id);
                      setSignature("");
                    }}
                  >
                    <span className="min-w-0">
                      <span className="block font-semibold text-brand-charcoal">
                        {truck?.number ?? submission.truckId} · {driver?.fullName ?? "Unknown driver"}
                      </span>
                      <span className="block text-xs text-brand-steel">
                        {new Date(submission.submittedAt).toLocaleString()} ·{" "}
                        {submission.mileage.toLocaleString()} mi
                        {submission.routeNote ? ` · ${submission.routeNote}` : ""}
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                          unsafe || submission.hasFailures
                            ? "bg-red-50 text-red-700"
                            : "bg-status-complete/15 text-status-complete"
                        }`}
                      >
                        {unsafe ? "Unsafe" : submission.hasFailures ? "Defects" : "Passed"}
                      </span>
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                          signed ? "bg-brand-mist text-brand-steel" : "bg-status-pending/15 text-status-pending"
                        }`}
                      >
                        {signed ? "Signed" : "Awaiting"}
                      </span>
                    </span>
                  </button>

                  {expanded && (
                    <div className="space-y-4 border-t border-brand-ice p-4">
                      <dl className="grid gap-2 text-sm sm:grid-cols-2">
                        <div>
                          <dt className="text-xs text-brand-steel">Safe to operate</dt>
                          <dd className={unsafe ? "font-semibold text-red-700" : ""}>
                            {submission.safeToOperate === null
                              ? "Not recorded"
                              : submission.safeToOperate
                                ? "Yes"
                                : "No"}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-xs text-brand-steel">VIN</dt>
                          <dd>{submission.vinSnapshot || "Not recorded"}</dd>
                        </div>
                        <div>
                          <dt className="text-xs text-brand-steel">Driver signature</dt>
                          <dd>{submission.signature}</dd>
                        </div>
                        <div>
                          <dt className="text-xs text-brand-steel">Supervisor signature</dt>
                          <dd>
                            {signed
                              ? `${signed}${submission.supervisorSignedAt ? ` · ${new Date(submission.supervisorSignedAt).toLocaleString()}` : ""}`
                              : "Awaiting"}
                          </dd>
                        </div>
                      </dl>

                      {(submission.defectsFound || submission.repairsRequired) && (
                        <div className="space-y-2 rounded border border-brand-ice p-3 text-sm">
                          {submission.defectsFound && (
                            <p>
                              <span className="text-xs text-brand-steel">Defects found</span>
                              <br />
                              {submission.defectsFound}
                            </p>
                          )}
                          {submission.repairsRequired && (
                            <p>
                              <span className="text-xs text-brand-steel">Repairs required</span>
                              <br />
                              {submission.repairsRequired}
                            </p>
                          )}
                        </div>
                      )}

                      <ResultList template={template} results={submission.results} />

                      {signed ? (
                        <p className="text-sm text-brand-steel">
                          Counter-signed. An inspection is signed off once, so this cannot be
                          replaced.
                        </p>
                      ) : submission.driverId === currentUser?.id ? (
                        <p className="text-sm text-brand-steel">
                          You submitted this inspection, so it needs a different supervisor to
                          sign it off.
                        </p>
                      ) : (
                        <div className="space-y-2">
                          <FormField label="Supervisor signature (typed)" required>
                            <Input
                              value={signature}
                              onChange={(event) => setSignature(event.target.value)}
                              maxLength={120}
                              placeholder={currentUser?.fullName}
                            />
                          </FormField>
                          <Button
                            disabled={!canMutate || busy === submission.id}
                            onClick={() => void countersign(submission)}
                          >
                            {busy === submission.id ? "Signing…" : "Counter-sign inspection"}
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}

/**
 * Answers in the template's own order and grouping, so a reviewer reads them
 * the way the driver filled them in. Falls back to the raw key for an answer
 * whose item has since been removed from the template.
 */
function ResultList({
  template,
  results,
}: {
  template?: PretripTemplate;
  results: Record<string, PretripResult>;
}) {
  const items = template?.items ?? [];
  const known = new Set(items.map((item) => item.id));
  const orphans = Object.keys(results).filter((id) => !known.has(id));
  const sections: { section: string; items: { id: string; label: string }[] }[] = [];
  for (const item of items) {
    const key = item.section ?? "";
    const last = sections[sections.length - 1];
    if (last && last.section === key) last.items.push(item);
    else sections.push({ section: key, items: [item] });
  }
  if (orphans.length)
    sections.push({
      section: "No longer on the checklist",
      items: orphans.map((id) => ({ id, label: id })),
    });

  return (
    <div className="space-y-3">
      {sections.map(({ section, items: sectionItems }) => (
        <div key={section || "checklist"} className="rounded border border-brand-ice">
          {section && (
            <h3 className="border-b border-brand-ice bg-brand-mist px-3 py-2 font-heading text-xs font-semibold uppercase tracking-wide text-brand-charcoal">
              {section}
            </h3>
          )}
          <ul className="divide-y divide-brand-ice">
            {sectionItems.map((item) => {
              const answer = results[item.id];
              return (
                <li key={item.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                  <span>{item.label}</span>
                  <span className={answer ? resultTone[answer] : "text-brand-steel"}>
                    {answer ? resultLabel[answer] : "—"}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}

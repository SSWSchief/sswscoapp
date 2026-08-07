"use client";
import * as React from "react";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  mapCompanySettings,
  mapInvoice,
  mapMessageChannel,
  mapPretripSubmission,
  mapPretripTemplate,
  mapSopDocument,
  mapTeamMessage,
} from "@/lib/supabase/mappers";
import type {
  CompanySettings,
  InvoiceRecord,
  InvoiceStatus,
  MessageChannel,
  PretripSubmission,
  PretripTemplate,
  SopDocument,
  TeamMessage,
  TrainingDataset,
  TrainingDatasetMutation,
} from "@/lib/types";
import type {
  CompanySettingsRow,
  InvoiceRow,
  MessageChannelRow,
  MessageReadRow,
  MessageRow,
  PretripSubmissionRow,
  PretripTemplateRow,
  SopAcknowledgementRow,
  SopDocumentRow,
} from "@/lib/supabase/database.types";
import { useOperations, type MutationResult } from "./OperationsProvider";
import {
  expandedDomainsForPath,
  expandedTableDomain,
  type ExpandedDomain,
} from "@/lib/operations/route-domains";
import { log } from "@/lib/logger";

interface InvoiceInput {
  invoiceNumber: string;
  customerId: string;
  jobId: string | null;
  amountCents: number;
  status: InvoiceStatus;
  dueDate: string;
  notes: string;
}
type State = {
  invoices: InvoiceRecord[];
  channels: MessageChannel[];
  messages: TeamMessage[];
  messageRecipients: { id: string; fullName: string }[];
  pretripTemplates: PretripTemplate[];
  pretripSubmissions: PretripSubmission[];
  sops: SopDocument[];
  settings: CompanySettings | null;
  trainingDataset: TrainingDataset;
};
type Value = State & {
  loading: boolean;
  refresh: () => Promise<void>;
  saveInvoice: (
    input: InvoiceInput,
    id?: string,
  ) => Promise<MutationResult<void>>;
  sendMessage: (
    channelId: string,
    body: string,
  ) => Promise<MutationResult<void>>;
  createDirectChannel: (userId: string) => Promise<MutationResult<string>>;
  markChannelRead: (channelId: string) => Promise<MutationResult<void>>;
  submitPretrip: (input: {
    templateId: string;
    truckId: string;
    mileage: number;
    signature: string;
    results: Record<string, "pass" | "fail">;
  }) => Promise<MutationResult<void>>;
  acknowledgeSop: (sopId: string) => Promise<MutationResult<void>>;
  saveSettings: (value: CompanySettings) => Promise<MutationResult<void>>;
  publishSop: (input: {
    title: string;
    category: string;
    body: string;
    requiredForDrivers: boolean;
  }) => Promise<MutationResult<void>>;
  publishPretripTemplate: (input: {
    title: string;
    items: string[];
  }) => Promise<MutationResult<void>>;
  provisionTrainingDataset: () => Promise<
    MutationResult<TrainingDatasetMutation>
  >;
  removeTrainingDataset: (
    datasetKey: "training-v1",
  ) => Promise<MutationResult<TrainingDatasetMutation>>;
};
const Context = React.createContext<Value | null>(null);
const initial: State = {
  invoices: [],
  channels: [],
  messages: [],
  messageRecipients: [],
  pretripTemplates: [],
  pretripSubmissions: [],
  sops: [],
  settings: null,
  trainingDataset: {
    datasetKey: "training-v1",
    status: "not_provisioned",
    recordIds: {},
  },
};
const fail = (e: unknown): MutationResult<never> => ({
  ok: false,
  error: {
    code: (e as { code?: string })?.code ?? "expanded_operation_failed",
    message:
      (e as { message?: string })?.message ??
      "The operation could not be completed.",
  },
});

export function ExpandedOperationsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const activeDomains = React.useMemo(
    () => expandedDomainsForPath(pathname),
    [pathname],
  );
  const { currentUser, canMutate } = useOperations();
  const [loading, setLoading] = React.useState(activeDomains.size > 0);
  const [data, setData] = React.useState<State>(initial);
  const refresh = React.useCallback(
    async (requestedDomains?: ReadonlySet<ExpandedDomain>) => {
      const domains = requestedDomains ?? activeDomains;
      if (!currentUser || domains.size === 0) {
        setLoading(false);
        return;
      }
      const started = Date.now();
      setLoading(true);
      try {
        const db = createClient();
        const patch: Partial<State> = {};
        if (domains.has("finance")) {
          const result = await db
            .from("invoices")
            .select("*")
            .order("due_date")
            .limit(50);
          if (result.error) throw result.error;
          patch.invoices = (result.data as InvoiceRow[]).map(mapInvoice);
        }
        if (domains.has("messaging")) {
          const [channels, messages, reads, recipients] = await Promise.all([
            db.rpc("list_message_channels"),
            db
              .from("messages")
              .select("*")
              .order("created_at", { ascending: false })
              .limit(50),
            db
              .from("message_reads")
              .select("*")
              .eq("user_id", currentUser.id)
              .limit(50),
            db.rpc("list_message_recipients"),
          ]);
          const error = [channels, messages, reads, recipients].find(
            (result) => result.error,
          )?.error;
          if (error) throw error;
          const readIds = new Set(
            (reads.data as MessageReadRow[]).map((row) => row.message_id),
          );
          patch.channels = (channels.data as MessageChannelRow[]).map(
            mapMessageChannel,
          );
          patch.messages = (messages.data as MessageRow[]).map((row) =>
            mapTeamMessage(row, readIds.has(row.id)),
          );
          patch.messageRecipients = (
            (recipients.data ?? []) as { id: string; full_name: string }[]
          )
            .slice(0, 50)
            .map((row) => ({ id: row.id, fullName: row.full_name }));
        }
        if (domains.has("compliance")) {
          const [templates, submissions, sops, acknowledgements] =
            await Promise.all([
              db
                .from("pretrip_templates")
                .select("*")
                .order("version", { ascending: false })
                .limit(50),
              db
                .from("pretrip_submissions")
                .select("*")
                .order("submitted_at", { ascending: false })
                .limit(50),
              db
                .from("sop_documents")
                .select("*")
                .order("created_at", { ascending: false })
                .limit(50),
              db
                .from("sop_acknowledgements")
                .select("*")
                .eq("user_id", currentUser.id)
                .limit(50),
            ]);
          const error = [templates, submissions, sops, acknowledgements].find(
            (result) => result.error,
          )?.error;
          if (error) throw error;
          const ackIds = new Set(
            (acknowledgements.data as SopAcknowledgementRow[]).map(
              (row) => row.sop_id,
            ),
          );
          patch.pretripTemplates = (templates.data as PretripTemplateRow[]).map(
            mapPretripTemplate,
          );
          patch.pretripSubmissions = (
            submissions.data as PretripSubmissionRow[]
          ).map(mapPretripSubmission);
          patch.sops = (sops.data as SopDocumentRow[]).map((row) =>
            mapSopDocument(row, ackIds.has(row.id)),
          );
        }
        if (domains.has("settings")) {
          const [settingsResult, trainingResult] = await Promise.all([
            db.from("company_settings").select("*").maybeSingle(),
            currentUser.accessRole === "admin"
              ? db.rpc("get_training_dataset_status")
              : Promise.resolve({ data: null, error: null }),
          ]);
          if (settingsResult.error || trainingResult.error)
            throw settingsResult.error ?? trainingResult.error;
          patch.settings = settingsResult.data
            ? mapCompanySettings(settingsResult.data as CompanySettingsRow)
            : null;
          if (trainingResult.data)
            patch.trainingDataset =
              trainingResult.data as unknown as TrainingDataset;
        }
        setData((previous) => ({ ...previous, ...patch }));
        log("info", "expanded_operations_refresh_complete", {
          domains: [...domains],
          durationMs: Date.now() - started,
        });
      } catch (error) {
        log("error", "expanded_operations_refresh_failed", {
          message: error instanceof Error ? error.message : "unknown",
          domains: [...domains],
          durationMs: Date.now() - started,
        });
      } finally {
        setLoading(false);
      }
    },
    [activeDomains, currentUser],
  );
  React.useEffect(() => {
    void refresh();
    if (!currentUser || activeDomains.size === 0) return;
    const db = createClient();
    const channel = db.channel(`expanded-${pathname.replaceAll("/", "-")}`);
    for (const [table, domain] of Object.entries(expandedTableDomain)) {
      if (activeDomains.has(domain))
        channel.on(
          "postgres_changes",
          { event: "*", schema: "public", table },
          () => void refresh(new Set([domain])),
        );
    }
    channel.subscribe();
    return () => {
      void db.removeChannel(channel);
    };
  }, [activeDomains, currentUser, pathname, refresh]);
  const run = React.useCallback(
    async (
      work: () => PromiseLike<{ error: unknown }>,
      domain: ExpandedDomain,
    ) => {
      if (!canMutate)
        return fail({
          message:
            "Changes are disabled until the live connection is restored.",
        });
      try {
        const r = await work();
        if (r.error) throw r.error;
        await refresh(new Set([domain]));
        return { ok: true, data: undefined } as MutationResult<void>;
      } catch (e) {
        return fail(e);
      }
    },
    [canMutate, refresh],
  );
  const runWithData = React.useCallback(
    async <T,>(work: () => PromiseLike<{ data: unknown; error: unknown }>) => {
      if (!canMutate)
        return fail({
          message:
            "Changes are disabled until the live connection is restored.",
        });
      try {
        const result = await work();
        if (result.error) throw result.error;
        await refresh(new Set(["settings"]));
        return { ok: true, data: result.data as T } as MutationResult<T>;
      } catch (error) {
        return fail(error);
      }
    },
    [canMutate, refresh],
  );
  const value = React.useMemo<Value>(
    () => ({
      loading,
      ...data,
      refresh,
      saveInvoice: (input, id) =>
        run(
          () =>
            id
              ? createClient()
                  .from("invoices")
                  .update({
                    invoice_number: input.invoiceNumber.trim(),
                    customer_id: input.customerId,
                    job_id: input.jobId,
                    amount_cents: input.amountCents,
                    status: input.status,
                    due_date: input.dueDate,
                    notes: input.notes.trim(),
                  })
                  .eq("id", id)
              : createClient().from("invoices").insert({
                  invoice_number: input.invoiceNumber.trim(),
                  customer_id: input.customerId,
                  job_id: input.jobId,
                  amount_cents: input.amountCents,
                  status: input.status,
                  due_date: input.dueDate,
                  notes: input.notes.trim(),
                  created_by_id: currentUser?.id,
                }),
          "finance",
        ),
      sendMessage: (channelId, body) =>
        run(
          () =>
            createClient().from("messages").insert({
              channel_id: channelId,
              sender_id: currentUser?.id,
              body: body.trim(),
            }),
          "messaging",
        ),
      createDirectChannel: async (userId) => {
        if (!canMutate)
          return fail({
            message:
              "Changes are disabled until the live connection is restored.",
          });
        try {
          const r = await createClient().rpc("create_direct_message_channel", {
            other_user_id: userId,
          });
          if (r.error) throw r.error;
          await refresh();
          return { ok: true, data: r.data };
        } catch (e) {
          return fail(e);
        }
      },
      markChannelRead: (channelId) => {
        const unread = data.messages
          .filter(
            (m) =>
              m.channelId === channelId &&
              !m.read &&
              m.senderId !== currentUser?.id,
          )
          .map((m) => ({ message_id: m.id, user_id: currentUser?.id }));
        if (!unread.length)
          return Promise.resolve({ ok: true, data: undefined });
        return run(
          () => createClient().from("message_reads").upsert(unread),
          "messaging",
        );
      },
      submitPretrip: (input) =>
        run(async () => {
          if (!currentUser) return { error: { message: "Sign in required" } };
          const hasFailures = Object.values(input.results).includes("fail");
          const r = await createClient().from("pretrip_submissions").insert({
            template_id: input.templateId,
            driver_id: currentUser.id,
            truck_id: input.truckId,
            mileage: input.mileage,
            signature: input.signature.trim(),
            results: input.results,
            has_failures: hasFailures,
          });
          return r;
        }, "compliance"),
      acknowledgeSop: (sopId) =>
        run(
          () =>
            createClient()
              .from("sop_acknowledgements")
              .upsert({ sop_id: sopId, user_id: currentUser?.id }),
          "compliance",
        ),
      saveSettings: (settings) =>
        run(
          () =>
            createClient().rpc("save_company_settings", {
              company_name: settings.companyName,
              company_address: settings.address,
              company_phone: settings.phone,
              company_email: settings.email,
              company_time_zone: settings.timeZone,
              company_date_format: settings.dateFormat,
              retention_days: settings.messageRetentionDays,
              invoice_prefix: settings.invoicePrefix,
            }),
          "settings",
        ),
      publishSop: (input) =>
        run(
          () =>
            createClient().rpc("publish_sop_document", {
              sop_title: input.title,
              sop_category: input.category,
              sop_body: input.body,
              required_for_drivers: input.requiredForDrivers,
            }),
          "compliance",
        ),
      publishPretripTemplate: (input) =>
        run(
          () =>
            createClient().rpc("publish_pretrip_template", {
              template_title: input.title,
              item_labels: input.items,
            }),
          "compliance",
        ),
      provisionTrainingDataset: () =>
        runWithData<TrainingDatasetMutation>(() =>
          createClient().rpc("provision_training_dataset"),
        ),
      removeTrainingDataset: (datasetKey) =>
        runWithData<TrainingDatasetMutation>(() =>
          createClient().rpc("remove_training_dataset", {
            requested_dataset_key: datasetKey,
          }),
        ),
    }),
    [loading, data, refresh, run, runWithData, currentUser, canMutate],
  );
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useExpandedOperations() {
  const value = React.useContext(Context);
  if (!value)
    throw new Error(
      "useExpandedOperations must be used inside ExpandedOperationsProvider",
    );
  return value;
}

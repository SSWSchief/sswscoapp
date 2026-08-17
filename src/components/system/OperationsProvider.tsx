"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  mapAbsence,
  mapActivity,
  mapCustomer,
  mapDumpster,
  mapJob,
  mapJobNote,
  mapNotification,
  mapTimeCorrection,
  mapTimeEntry,
  mapTimeRequest,
  mapTruck,
  mapUser,
} from "@/lib/supabase/mappers";
import {
  applyTimeCorrections,
  pacificDate,
  pacificDayStart,
} from "@/lib/time-clock";
import type {
  AccessRole,
  AbsenceEvent,
  AppNotification,
  Customer,
  Dumpster,
  DumpsterSize,
  Job,
  JobActivity,
  JobNote,
  JobStatus,
  PermissionKey,
  ServiceType,
  TimeEntry,
  TimeEntryCorrection,
  TimeEntryType,
  TimeRequest,
  Truck,
  User,
  UserRole,
} from "@/lib/types";
import type {
  CorrectionRow,
  CustomerRow,
  DumpsterRow,
  JobActivityRow,
  JobEventRow,
  JobNoteRow,
  JobPhotoRow,
  JobRow,
  NotificationRow,
  TimeEntryRow,
  TimeRequestRow,
  TruckRow,
  UserRow,
  AbsenceRow,
} from "@/lib/supabase/database.types";
import {
  coreDomainsForPath,
  coreTableDomain,
  detailEmployeeId,
  detailJobId,
  detailTruckId,
  type CoreDomain,
} from "@/lib/operations/route-domains";
import { log } from "@/lib/logger";
import { apiErrorMessage } from "@/lib/client-api";

type ConnectionState =
  "loading" | "ready" | "stale" | "offline" | "unauthorized" | "error";
export type MutationResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string } };
interface State {
  jobs: Job[];
  notifications: AppNotification[];
  activities: JobActivity[];
  users: User[];
  customers: Customer[];
  trucks: Truck[];
  dumpsters: Dumpster[];
  jobNotes: JobNote[];
  timeEntries: TimeEntry[];
  timeEntryCorrections: TimeEntryCorrection[];
  timeRequests: TimeRequest[];
  absenceEvents: AbsenceEvent[];
  protectedAdministratorIds: string[];
}
const emptyState: State = {
  jobs: [],
  notifications: [],
  activities: [],
  users: [],
  customers: [],
  trucks: [],
  dumpsters: [],
  jobNotes: [],
  timeEntries: [],
  timeEntryCorrections: [],
  timeRequests: [],
  absenceEvents: [],
  protectedAdministratorIds: [],
};
interface CreateJobInput {
  customerId: string;
  address: string;
  phone: string;
  serviceType: ServiceType;
  dumpsterSize: DumpsterSize;
  assignedDriverId: string | null;
  assignedTruckId: string | null;
  assignedDumpsterId: string | null;
  scheduledFor: string;
  notes: string;
  trafficInstructions: string;
}
interface CustomerInput {
  name: string;
  phone: string;
  email: string;
  address: string;
  group?: Customer["group"];
}
interface TruckInput {
  number: string;
  type: string;
  status: Truck["status"];
  licensePlate: string;
  assignedDriverId: string | null;
  notes: string;
}
interface DumpsterInput {
  code: string;
  size: Dumpster["size"];
  status: Dumpster["status"];
  type: string;
  airTagId: string | null;
  currentLocation: string;
  notes: string;
}
interface TimeRequestInput {
  kind: "edit_time" | "pto";
  requestedFor: string;
  hours: number;
  reason: string;
  targetEntryId?: string | null;
  requestedEntryType?: TimeEntryType | null;
  requestedAt?: string | null;
}

interface Value extends State {
  hydrated: boolean;
  connected: boolean;
  connectionState: ConnectionState;
  connectionMessage: string | null;
  canMutate: boolean;
  currentUser: User | null;
  refresh: () => Promise<void>;
  createJob: (input: CreateJobInput) => Promise<MutationResult<Job>>;
  updateJob: (
    id: string,
    input: CreateJobInput,
  ) => Promise<MutationResult<void>>;
  updateJobStatus: (
    id: string,
    status: JobStatus,
  ) => Promise<MutationResult<void>>;
  completeJobAsDispatcher: (
    id: string,
    reason?: string,
  ) => Promise<MutationResult<Job>>;
  cancelJob: (id: string, reason: string) => Promise<MutationResult<Job>>;
  logDryRun: (id: string, reason: string) => Promise<MutationResult<void>>;
  assignDriver: (
    jobId: string,
    driverId: string,
  ) => Promise<MutationResult<Job>>;
  acknowledgeNotification: (id: string) => Promise<MutationResult<void>>;
  acknowledgeAll: (recipient: string) => Promise<MutationResult<void>>;
  notificationsFor: (recipient: string) => AppNotification[];
  setUserAccessRole: (
    id: string,
    role: AccessRole,
  ) => Promise<MutationResult<void>>;
  setPermissionOverride: (
    id: string,
    key: PermissionKey,
    value: boolean,
  ) => Promise<MutationResult<void>>;
  resetPermissionOverrides: (id: string) => Promise<MutationResult<void>>;
  updateEmployeeDetails: (
    id: string,
    input: {
      employeeId?: string;
      fullName?: string;
      email?: string;
      phone?: string;
      role?: UserRole;
    },
  ) => Promise<MutationResult<void>>;
  recordTimeEntry: (type: TimeEntryType) => Promise<MutationResult<TimeEntry>>;
  createTimeRequest: (input: TimeRequestInput) => Promise<MutationResult<void>>;
  reviewTimeRequest: (
    id: string,
    decision: "approved" | "denied",
  ) => Promise<MutationResult<void>>;
  uploadJobPhotos: (
    jobId: string,
    files: File[],
  ) => Promise<MutationResult<void>>;
  addJobNote: (jobId: string, body: string) => Promise<MutationResult<void>>;
  saveCustomer: (
    input: CustomerInput,
    id?: string,
  ) => Promise<MutationResult<void>>;
  deactivateCustomer: (id: string) => Promise<MutationResult<void>>;
  saveTruck: (input: TruckInput, id?: string) => Promise<MutationResult<void>>;
  saveDumpster: (
    input: DumpsterInput,
    id?: string,
  ) => Promise<MutationResult<void>>;
}
const Context = React.createContext<Value | null>(null);
function failure(error: unknown): MutationResult<never> {
  const candidate = error as { code?: string; message?: string };
  return {
    ok: false,
    error: {
      code: candidate?.code ?? "unexpected_error",
      message: candidate?.message ?? "The operation could not be completed.",
    },
  };
}

export function OperationsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const activeDomains = React.useMemo(
    () => coreDomainsForPath(pathname),
    [pathname],
  );
  const activeJobId = React.useMemo(() => detailJobId(pathname), [pathname]);
  const activeEmployeeId = React.useMemo(
    () => detailEmployeeId(pathname),
    [pathname],
  );
  const activeTruckId = React.useMemo(
    () => detailTruckId(pathname),
    [pathname],
  );
  const [state, setState] = React.useState<State>(emptyState);
  const [connectionState, setConnectionState] =
    React.useState<ConnectionState>("loading");
  const [connectionMessage, setConnectionMessage] = React.useState<
    string | null
  >(null);
  const [currentUser, setCurrentUser] = React.useState<User | null>(null);
  const loaded = React.useRef(false);
  const refresh = React.useCallback(
    async (requestedDomains?: ReadonlySet<CoreDomain>) => {
      const domains = requestedDomains ?? activeDomains;
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        setConnectionState(loaded.current ? "stale" : "offline");
        setConnectionMessage(
          "Offline. Operational changes are disabled until connectivity returns.",
        );
        return;
      }
      const started = Date.now();
      try {
        const db = createClient();
        const auth = await db.auth.getUser();
        if (auth.error?.name === "AuthSessionMissingError" || !auth.data.user) {
          setCurrentUser(null);
          setConnectionState("unauthorized");
          setConnectionMessage("Sign in to access operations data.");
          return;
        }
        if (auth.error) throw auth.error;
        const profileResult = await db
          .from("users")
          .select("*")
          .eq("auth_user_id", auth.data.user.id)
          .eq("status", "active")
          .is("deleted_at", null)
          .maybeSingle();
        if (profileResult.error) throw profileResult.error;
        if (!profileResult.data) {
          setCurrentUser(null);
          setConnectionState("unauthorized");
          setConnectionMessage(
            "Your account is not linked to an active employee profile.",
          );
          return;
        }
        const profile = mapUser(profileResult.data as UserRow);
        const patch: Partial<State> = {};
        let users: User[] = [profile];
        if (domains.has("people")) {
          const [result, detail, protectedAdministrators] = await Promise.all([
            db
              .from("users")
              .select("*")
              .is("deleted_at", null)
              .order("full_name")
              .limit(50),
            activeEmployeeId
              ? db
                  .from("users")
                  .select("*")
                  .eq("id", activeEmployeeId)
                  .is("deleted_at", null)
                  .maybeSingle()
              : Promise.resolve({ data: null, error: null }),
            db.rpc("list_protected_administrator_ids"),
          ]);
          if (result.error || detail.error || protectedAdministrators.error)
            throw result.error ?? detail.error ?? protectedAdministrators.error;
          const rows = result.data as UserRow[];
          const detailRow = detail.data as UserRow | null;
          if (detailRow && !rows.some((row) => row.id === detailRow.id))
            rows.push(detailRow);
          users = rows.map(mapUser);
          patch.users = users;
          patch.protectedAdministratorIds = (
            (protectedAdministrators.data ?? []) as { user_id: string }[]
          ).map((row) => row.user_id);
        }
        let jobs: Job[] = [];
        if (domains.has("jobs")) {
          const jobsQuery = db
            .from("jobs")
            .select("*")
            .is("deleted_at", null)
            .order("scheduled_for")
            .limit(50);
          const jobDetailQuery = activeJobId
            ? db
                .from("jobs")
                .select("*")
                .eq("id", activeJobId)
                .is("deleted_at", null)
                .maybeSingle()
            : Promise.resolve({ data: null, error: null });
          const photosQuery = activeJobId
            ? db
                .from("job_photos")
                .select("*")
                .eq("job_id", activeJobId)
                .limit(50)
            : Promise.resolve({ data: [], error: null });
          const eventsQuery = activeJobId
            ? db
                .from("job_events")
                .select("*")
                .eq("job_id", activeJobId)
                .order("created_at")
                .limit(50)
            : Promise.resolve({ data: [], error: null });
          const notesQuery = activeJobId
            ? db
                .from("job_notes")
                .select("*")
                .eq("job_id", activeJobId)
                .order("created_at")
                .limit(50)
            : Promise.resolve({ data: [], error: null });
          const activitiesQuery = db
            .from("job_activities")
            .select("*")
            .order("created_at", { ascending: false })
            .limit(50);
          const [jr, detail, pr, er, noter, ar] = await Promise.all([
            jobsQuery,
            jobDetailQuery,
            photosQuery,
            eventsQuery,
            notesQuery,
            activitiesQuery,
          ]);
          const error = [jr, detail, pr, er, noter, ar].find(
            (result) => result.error,
          )?.error;
          if (error) throw error;
          const photos = (pr.data ?? []) as JobPhotoRow[];
          await Promise.all(
            photos.map(async (photo) => {
              if (!photo.storage_path) return;
              const signed = await db.storage
                .from("job-photos")
                .createSignedUrl(photo.storage_path, 3600);
              if (signed.data?.signedUrl) photo.url = signed.data.signedUrl;
            }),
          );
          const rows = jr.data as JobRow[];
          const detailRow = detail.data as JobRow | null;
          if (detailRow && !rows.some((row) => row.id === detailRow.id))
            rows.push(detailRow);
          jobs = rows.map((row) =>
            mapJob(row, photos, (er.data ?? []) as JobEventRow[]),
          );
          const names = new Map(users.map((user) => [user.id, user.fullName]));
          patch.jobs = jobs;
          patch.activities = ((ar.data ?? []) as JobActivityRow[]).map(
            mapActivity,
          );
          patch.jobNotes = ((noter.data ?? []) as JobNoteRow[]).map((row) =>
            mapJobNote(row, names.get(row.author_id)),
          );
        }
        if (domains.has("notifications")) {
          const result = await db
            .from("notifications")
            .select("*")
            .order("created_at", { ascending: false })
            .limit(50);
          if (result.error) throw result.error;
          patch.notifications = (result.data as NotificationRow[]).map(
            mapNotification,
          );
        }
        if (domains.has("customers")) {
          const [result, activeCounts] = await Promise.all([
            db
              .from("customers")
              .select("*")
              .is("deleted_at", null)
              .order("name")
              .limit(50),
            db.rpc("customer_active_job_counts"),
          ]);
          if (result.error || activeCounts.error)
            throw result.error ?? activeCounts.error;
          const counts = new Map(
            activeCounts.data.map((row) => [
              row.customer_id,
              Number(row.active_jobs),
            ]),
          );
          patch.customers = (result.data as CustomerRow[]).map((row) =>
            mapCustomer(row, counts.get(row.id) ?? 0),
          );
        }
        if (domains.has("fleet")) {
          const [trucks, truckDetail, dumpsters] = await Promise.all([
            db
              .from("trucks")
              .select("*")
              .is("deleted_at", null)
              .order("number")
              .limit(50),
            activeTruckId
              ? db
                  .from("trucks")
                  .select("*")
                  .eq("id", activeTruckId)
                  .is("deleted_at", null)
                  .maybeSingle()
              : Promise.resolve({ data: null, error: null }),
            db
              .from("dumpsters")
              .select("*")
              .is("deleted_at", null)
              .order("code")
              .limit(50),
          ]);
          if (trucks.error || truckDetail.error || dumpsters.error)
            throw trucks.error ?? truckDetail.error ?? dumpsters.error;
          const truckRows = trucks.data as TruckRow[];
          const detailRow = truckDetail.data as TruckRow | null;
          if (detailRow && !truckRows.some((row) => row.id === detailRow.id))
            truckRows.push(detailRow);
          patch.trucks = truckRows.map(mapTruck);
          patch.dumpsters = (dumpsters.data as DumpsterRow[]).map(mapDumpster);
        }
        if (domains.has("time")) {
          // Scoped to the current Pacific day rather than a flat row cap. Every
          // view built on these entries summarises today, and a bare `limit`
          // silently drops whoever punched in earliest once enough people are
          // on the clock — which adding dispatch and office staff does. The
          // remaining limit is a runaway guard, not a working constraint.
          const dayStart = pacificDayStart(pacificDate(new Date()));
          const [entries, corrections, requests, absences] = await Promise.all([
            db
              .from("time_entries")
              .select("*")
              .gte("occurred_at", dayStart)
              .order("occurred_at", { ascending: false })
              .limit(500),
            db
              .from("time_entry_corrections")
              .select("*")
              .order("created_at", { ascending: false })
              .limit(500),
            db
              .from("time_requests")
              .select("*")
              .order("created_at", { ascending: false })
              .limit(50),
            db.from("absence_events").select("*").order("event_date").limit(50),
          ]);
          const error = [entries, corrections, requests, absences].find(
            (result) => result.error,
          )?.error;
          if (error) throw error;
          const mappedCorrections = (corrections.data as CorrectionRow[]).map(
            mapTimeCorrection,
          );
          patch.timeEntryCorrections = mappedCorrections;
          patch.timeEntries = applyTimeCorrections(
            (entries.data as TimeEntryRow[]).map(mapTimeEntry),
            mappedCorrections,
          );
          patch.timeRequests = (requests.data as TimeRequestRow[]).map(
            mapTimeRequest,
          );
          patch.absenceEvents = (absences.data as AbsenceRow[]).map(mapAbsence);
        }
        setState((previous) => ({ ...previous, ...patch }));
        setCurrentUser(profile);
        loaded.current = true;
        setConnectionState("ready");
        setConnectionMessage(null);
        log("info", "operations_refresh_complete", {
          domains: [...domains],
          durationMs: Date.now() - started,
        });
      } catch (error) {
        log("error", "operations_refresh_failed", {
          message: error instanceof Error ? error.message : "unknown",
          domains: [...domains],
          durationMs: Date.now() - started,
        });
        setConnectionState(loaded.current ? "stale" : "error");
        setConnectionMessage(
          loaded.current
            ? "Live data is temporarily unavailable. Showing the last loaded records in read-only mode."
            : "Operations data could not be loaded.",
        );
      }
    },
    [activeDomains, activeEmployeeId, activeJobId, activeTruckId],
  );
  React.useEffect(() => {
    void refresh();
    const online = () => void refresh();
    const offline = () => {
      setConnectionState(loaded.current ? "stale" : "offline");
      setConnectionMessage(
        "Offline. Operational changes are disabled until connectivity returns.",
      );
    };
    window.addEventListener("online", online);
    window.addEventListener("offline", offline);
    const db = createClient();
    const channel = db.channel(`operations-${pathname.replaceAll("/", "-")}`);
    for (const [table, domain] of Object.entries(coreTableDomain)) {
      if (activeDomains.has(domain))
        channel.on(
          "postgres_changes",
          { event: "*", schema: "public", table },
          () => void refresh(new Set([domain])),
        );
    }
    channel.subscribe();
    const auth = db.auth.onAuthStateChange(() => void refresh());
    return () => {
      window.removeEventListener("online", online);
      window.removeEventListener("offline", offline);
      auth.data.subscription.unsubscribe();
      void db.removeChannel(channel);
    };
  }, [activeDomains, pathname, refresh]);
  const canMutate = connectionState === "ready";
  const guard = React.useCallback(
    () =>
      canMutate
        ? null
        : ({
            ok: false,
            error: {
              code: "read_only",
              message:
                "Changes are disabled until the live connection is restored.",
            },
          } as MutationResult<never>),
    [canMutate],
  );
  const run = React.useCallback(
    async <T,>(
      work: () => PromiseLike<{ data: T | null; error: unknown }>,
    ): Promise<MutationResult<T>> => {
      const blocked = guard();
      if (blocked) return blocked;
      try {
        const result = await work();
        if (result.error) throw result.error;
        await refresh();
        return { ok: true, data: result.data as T };
      } catch (error) {
        await refresh();
        return failure(error);
      }
    },
    [guard, refresh],
  );
  const value = React.useMemo<Value>(
    () => ({
      ...state,
      hydrated: connectionState !== "loading",
      connected: connectionState === "ready",
      connectionState,
      connectionMessage,
      canMutate,
      currentUser,
      refresh,
      createJob: (input) =>
        run(async () => {
          const r = await createClient().rpc("create_job", {
            customer_id: input.customerId,
            job_address: input.address,
            job_phone: input.phone,
            service: input.serviceType,
            container_size: input.dumpsterSize,
            driver_id: input.assignedDriverId,
            truck_id: input.assignedTruckId,
            dumpster_id: input.assignedDumpsterId,
            schedule_at: new Date(input.scheduledFor).toISOString(),
            job_notes: input.notes,
            traffic: input.trafficInstructions,
          });
          return { data: r.data ? mapJob(r.data) : null, error: r.error };
        }),
      updateJob: async (id, input) => {
        const r = await run(() =>
          createClient().rpc("edit_job", {
            target_job_id: id,
            customer_id: input.customerId,
            job_address: input.address,
            job_phone: input.phone,
            service: input.serviceType,
            container_size: input.dumpsterSize,
            driver_id: input.assignedDriverId,
            truck_id: input.assignedTruckId,
            dumpster_id: input.assignedDumpsterId,
            schedule_at: new Date(input.scheduledFor).toISOString(),
            job_notes: input.notes,
            traffic: input.trafficInstructions,
          }),
        );
        return r.ok ? { ok: true, data: undefined } : r;
      },
      updateJobStatus: async (id, status) => {
        const r = await run(() =>
          createClient().rpc("update_assigned_job_status", {
            target_job_id: id,
            next_status: status,
          }),
        );
        return r.ok ? { ok: true, data: undefined } : r;
      },
      completeJobAsDispatcher: (id, reason) =>
        run(async () => {
          const r = await createClient().rpc("complete_job_as_dispatch", {
            target_job_id: id,
            override_reason: reason ?? null,
          });
          return { data: r.data ? mapJob(r.data) : null, error: r.error };
        }),
      cancelJob: (id, reason) =>
        run(async () => {
          const r = await createClient().rpc("cancel_job", {
            target_job_id: id,
            cancel_reason: reason,
          });
          return { data: r.data ? mapJob(r.data) : null, error: r.error };
        }),
      logDryRun: async (id, reason) => {
        const r = await run(() =>
          createClient().rpc("log_assigned_job_dry_run", {
            target_job_id: id,
            dry_run_reason: reason,
          }),
        );
        return r.ok ? { ok: true, data: undefined } : r;
      },
      assignDriver: (jobId, driverId) =>
        run(async () => {
          const r = await createClient().rpc("assign_job", {
            target_job_id: jobId,
            driver_id: driverId,
          });
          return { data: r.data ? mapJob(r.data) : null, error: r.error };
        }),
      acknowledgeNotification: async (id) => {
        const r = await run(() =>
          createClient()
            .from("notifications")
            .update({ acknowledged_at: new Date().toISOString() })
            .eq("id", id)
            .select()
            .single(),
        );
        return r.ok ? { ok: true, data: undefined } : r;
      },
      acknowledgeAll: async (recipient) => {
        const r = await run(() =>
          createClient()
            .from("notifications")
            .update({ acknowledged_at: new Date().toISOString() })
            .eq("recipient_user_id", recipient)
            .is("acknowledged_at", null)
            .select(),
        );
        return r.ok ? { ok: true, data: undefined } : r;
      },
      notificationsFor: (recipient) =>
        state.notifications
          .filter((n) => n.recipientUserId === recipient)
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      setUserAccessRole: async (id, role) => {
        const r = await run(async () => {
          const response = await fetch(`/api/admin/employees/${id}`, {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ accessRole: role }),
          });
          return {
            data: null,
            error: response.ok
              ? null
              : {
                  message: await apiErrorMessage(
                    response,
                    "Access role could not be updated.",
                  ),
                },
          };
        });
        return r.ok ? { ok: true, data: undefined } : r;
      },
      setPermissionOverride: async (id, key, enabled) => {
        const user = state.users.find((u) => u.id === id);
        const overrides = { ...user?.permissionOverrides, [key]: enabled };
        const r = await run(async () => {
          const response = await fetch(`/api/admin/employees/${id}`, {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ permissionOverrides: overrides }),
          });
          return {
            data: null,
            error: response.ok
              ? null
              : {
                  message: await apiErrorMessage(
                    response,
                    "Permission could not be updated.",
                  ),
                },
          };
        });
        return r.ok ? { ok: true, data: undefined } : r;
      },
      resetPermissionOverrides: async (id) => {
        const r = await run(async () => {
          const response = await fetch(`/api/admin/employees/${id}`, {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ permissionOverrides: {} }),
          });
          return {
            data: null,
            error: response.ok
              ? null
              : {
                  message: await apiErrorMessage(
                    response,
                    "Permission overrides could not be reset.",
                  ),
                },
          };
        });
        return r.ok ? { ok: true, data: undefined } : r;
      },
      updateEmployeeDetails: async (id, patch) => {
        const r = await run(async () => {
          const response = await fetch(`/api/admin/employees/${id}`, {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(patch),
          });
          return {
            data: null,
            error: response.ok
              ? null
              : {
                  message: await apiErrorMessage(
                    response,
                    "Employee details could not be updated.",
                  ),
                },
          };
        });
        return r.ok ? { ok: true, data: undefined } : r;
      },
      recordTimeEntry: (type) =>
        run(async () => {
          const r = await createClient().rpc("record_time_event", {
            next_type: type,
          });
          return { data: r.data ? mapTimeEntry(r.data) : null, error: r.error };
        }),
      createTimeRequest: async (input) => {
        if (!currentUser)
          return failure({
            code: "unauthorized",
            message: "Sign in before submitting a request.",
          });
        const r = await run(() =>
          createClient()
            .from("time_requests")
            .insert({
              user_id: currentUser.id,
              kind: input.kind,
              status: "pending",
              requested_for: input.requestedFor,
              hours: input.hours,
              reason: input.reason.trim(),
              target_entry_id: input.targetEntryId ?? null,
              requested_entry_type: input.requestedEntryType ?? null,
              requested_at: input.requestedAt ?? null,
            })
            .select(),
        );
        return r.ok ? { ok: true, data: undefined } : r;
      },
      reviewTimeRequest: async (id, decision) => {
        const r = await run(() =>
          createClient().rpc("review_time_request", {
            request_id: id,
            decision,
          }),
        );
        return r.ok ? { ok: true, data: undefined } : r;
      },
      uploadJobPhotos: async (jobId, files) => {
        const blocked = guard();
        if (blocked) return blocked;
        try {
          for (const file of files) {
            if (file.size > 10 * 1024 * 1024)
              throw new Error(`${file.name} exceeds the 10 MB limit.`);
            if (
              !["image/jpeg", "image/png", "image/webp", "image/heic"].includes(
                file.type,
              )
            )
              throw new Error(`${file.name} is not a supported image type.`);
            const path = `${jobId}/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "-")}`;
            const upload = await createClient()
              .storage.from("job-photos")
              .upload(path, file, { contentType: file.type });
            if (upload.error) throw upload.error;
            const record = await createClient()
              .from("job_photos")
              .insert({
                job_id: jobId,
                storage_path: path,
                uploaded_by_id: currentUser?.id,
              })
              .select();
            if (record.error) {
              await createClient().storage.from("job-photos").remove([path]);
              throw record.error;
            }
          }
          await refresh();
          return { ok: true, data: undefined };
        } catch (error) {
          return failure(error);
        }
      },
      addJobNote: async (jobId, body) => {
        const r = await run(() =>
          createClient()
            .from("job_notes")
            .insert({
              job_id: jobId,
              author_id: currentUser?.id,
              body: body.trim(),
            })
            .select(),
        );
        return r.ok ? { ok: true, data: undefined } : r;
      },
      saveCustomer: async (input, id) => {
        const payload = {
          name: input.name.trim(),
          phone: input.phone.trim(),
          email: input.email.trim(),
          address: input.address.trim(),
          customer_group: input.group ?? null,
          is_active: true,
        };
        const r = await run(() =>
          id
            ? createClient()
                .from("customers")
                .update(payload)
                .eq("id", id)
                .select()
            : createClient().from("customers").insert(payload).select(),
        );
        return r.ok ? { ok: true, data: undefined } : r;
      },
      deactivateCustomer: async (id) => {
        const r = await run(() =>
          createClient()
            .from("customers")
            .update({ is_active: false, deleted_at: new Date().toISOString() })
            .eq("id", id)
            .select(),
        );
        return r.ok ? { ok: true, data: undefined } : r;
      },
      saveTruck: async (input, id) => {
        const payload = {
          number: input.number.trim(),
          type: input.type,
          status: input.status,
          license_plate: input.licensePlate.trim(),
          assigned_driver_id: input.assignedDriverId,
          notes: input.notes,
        };
        const r = await run(() =>
          id
            ? createClient()
                .from("trucks")
                .update(payload)
                .eq("id", id)
                .select()
            : createClient().from("trucks").insert(payload).select(),
        );
        return r.ok ? { ok: true, data: undefined } : r;
      },
      saveDumpster: async (input, id) => {
        const payload = {
          code: input.code.trim(),
          size: input.size,
          status: input.status,
          type: input.type,
          air_tag_id: input.airTagId,
          current_location: input.currentLocation.trim(),
          notes: input.notes,
        };
        const r = await run(() =>
          id
            ? createClient()
                .from("dumpsters")
                .update(payload)
                .eq("id", id)
                .select()
            : createClient().from("dumpsters").insert(payload).select(),
        );
        return r.ok ? { ok: true, data: undefined } : r;
      },
    }),
    [
      canMutate,
      connectionMessage,
      connectionState,
      currentUser,
      guard,
      refresh,
      run,
      state,
    ],
  );
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useOperations() {
  const value = React.useContext(Context);
  if (!value)
    throw new Error("useOperations must be used inside OperationsProvider");
  return value;
}

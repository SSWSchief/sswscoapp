"use client";

import * as React from "react";
import { appNotifications, jobActivities, jobs, users } from "@/lib/mock-data";
import type {
  AccessRole,
  AppNotification,
  DumpsterSize,
  Job,
  JobActivity,
  JobActivityType,
  JobStatus,
  PermissionKey,
  ServiceType,
  User,
} from "@/lib/types";

const STORAGE_KEY = "sswsco-demo-state-v2";

interface PersistedDemoState {
  jobs: Job[];
  notifications: AppNotification[];
  activities: JobActivity[];
  users: User[];
}

export interface CreateJobInput {
  customerId: string;
  address: string;
  phone: string;
  serviceType: ServiceType;
  dumpsterSize: DumpsterSize;
  assignedDriverId: string;
  assignedTruckId: string | null;
  assignedDumpsterId: string | null;
  scheduledFor: string;
  notes: string;
  trafficInstructions: string;
}

interface DemoStateValue extends PersistedDemoState {
  hydrated: boolean;
  createJob: (input: CreateJobInput) => Job;
  updateJobStatus: (jobId: string, status: JobStatus, actorId: string, actorName: string) => void;
  logDryRun: (jobId: string, actorId: string, actorName: string) => void;
  assignDriver: (jobId: string, driverId: string) => void;
  acknowledgeNotification: (notificationId: string) => void;
  acknowledgeAll: (recipientUserId: string) => void;
  notificationsFor: (recipientUserId: string) => AppNotification[];
  setUserAccessRole: (userId: string, role: AccessRole) => void;
  setPermissionOverride: (userId: string, permission: PermissionKey, value: boolean) => void;
  resetPermissionOverrides: (userId: string) => void;
  resetDemoData: () => void;
}

const seedState = (): PersistedDemoState => ({
  jobs: structuredClone(jobs),
  notifications: structuredClone(appNotifications),
  activities: structuredClone(jobActivities),
  users: structuredClone(users),
});

const DemoStateContext = React.createContext<DemoStateValue | null>(null);

export function DemoStateProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<PersistedDemoState>(seedState);
  const [hydrated, setHydrated] = React.useState(false);

  React.useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setState(JSON.parse(saved) as PersistedDemoState);
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    } finally {
      setHydrated(true);
    }
  }, []);

  React.useEffect(() => {
    if (hydrated) localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [hydrated, state]);

  const createJob = React.useCallback((input: CreateJobInput) => {
    const createdAt = new Date().toISOString();
    const nextReference = Math.max(
      ...state.jobs.map((job) => Number(job.reference.replace(/\D/g, "")) || 0),
      1051
    ) + 1;
    const created: Job = {
      id: `demo-job-${Date.now()}`,
      reference: `#${nextReference}`,
      customerId: input.customerId,
      address: input.address,
      phone: input.phone,
      serviceType: input.serviceType,
      dumpsterSize: input.dumpsterSize,
      assignedDriverId: input.assignedDriverId,
      assignedTruckId: input.assignedTruckId,
      assignedDumpsterId: input.assignedDumpsterId,
      scheduledFor: new Date(input.scheduledFor).toISOString(),
      status: "pending",
      notes: input.notes,
      trafficInstructions: input.trafficInstructions,
      photos: [],
      timeline: [
        { type: "created", at: createdAt },
        { type: "assigned", at: createdAt },
        { type: "en_route", at: null },
        { type: "arrived", at: null },
        { type: "completed", at: null },
      ],
    };
    setState((current) => {
      const activity: JobActivity = {
        id: `activity-${Date.now()}`,
        jobId: created.id,
        actorId: "u5",
        actorName: "Dispatch",
        type: "created",
        body: `${created.reference} created and assigned.`,
        createdAt,
        dispatchNotified: true,
      };
      const notification: AppNotification = {
        id: `notification-${Date.now()}`,
        recipientUserId: input.assignedDriverId,
        sourceRole: "dispatcher",
        category: "job_assignment",
        title: `New job assigned: ${created.reference}`,
        body: `${input.serviceType} at ${input.address}. Please acknowledge this assignment.`,
        relatedJobId: created.id,
        createdAt,
        requiresAcknowledgement: true,
        acknowledgedAt: null,
      };
      return {
        ...current,
        jobs: [...current.jobs, created],
        activities: [activity, ...current.activities],
        notifications: [notification, ...current.notifications],
      };
    });
    return created;
  }, [state.jobs]);

  const addDriverEvent = React.useCallback(
    (jobId: string, actorId: string, actorName: string, type: JobActivityType, body: string) => {
      const createdAt = new Date().toISOString();
      setState((current) => {
        const job = current.jobs.find((item) => item.id === jobId);
        if (!job) return current;
        const notification: AppNotification = {
          id: `notification-${Date.now()}-${type}`,
          recipientUserId: "u5",
          sourceRole: "driver",
          category: type === "dry_run" ? "dry_run" : "driver_status",
          title: `${actorName}: ${job.reference}`,
          body: `${body}. Dispatch acknowledgement requested.`,
          relatedJobId: jobId,
          createdAt,
          requiresAcknowledgement: true,
          acknowledgedAt: null,
        };
        const activity: JobActivity = {
          id: `activity-${Date.now()}-${type}`,
          jobId,
          actorId,
          actorName,
          type,
          body,
          createdAt,
          dispatchNotified: true,
        };
        return {
          ...current,
          activities: [activity, ...current.activities],
          notifications: [notification, ...current.notifications],
        };
      });
    },
    []
  );

  const updateJobStatus = React.useCallback(
    (jobId: string, status: JobStatus, actorId: string, actorName: string) => {
      const eventType: JobActivityType = status === "complete" ? "completed" : (status as JobActivityType);
      const body = status === "complete" ? "Job completed by driver" : `Driver marked ${status.replace("_", " ")}`;
      const now = new Date().toISOString();
      setState((current) => ({
        ...current,
        jobs: current.jobs.map((job) =>
          job.id === jobId
            ? {
                ...job,
                status,
                timeline: job.timeline.map((event) =>
                  event.type === eventType ? { ...event, at: now } : event
                ),
              }
            : job
        ),
      }));
      addDriverEvent(jobId, actorId, actorName, eventType, body);
    },
    [addDriverEvent]
  );

  const value = React.useMemo<DemoStateValue>(() => ({
    ...state,
    hydrated,
    createJob,
    updateJobStatus,
    logDryRun: (jobId, actorId, actorName) =>
      addDriverEvent(jobId, actorId, actorName, "dry_run", "Dry run logged from driver portal"),
    assignDriver: (jobId, driverId) =>
      setState((current) => ({
        ...current,
        jobs: current.jobs.map((job) =>
          job.id === jobId ? { ...job, assignedDriverId: driverId } : job
        ),
      })),
    acknowledgeNotification: (notificationId) =>
      setState((current) => ({
        ...current,
        notifications: current.notifications.map((notification) =>
          notification.id === notificationId
            ? { ...notification, acknowledgedAt: new Date().toISOString() }
            : notification
        ),
      })),
    acknowledgeAll: (recipientUserId) =>
      setState((current) => ({
        ...current,
        notifications: current.notifications.map((notification) =>
          notification.recipientUserId === recipientUserId && !notification.acknowledgedAt
            ? { ...notification, acknowledgedAt: new Date().toISOString() }
            : notification
        ),
      })),
    notificationsFor: (recipientUserId) =>
      state.notifications
        .filter((notification) => notification.recipientUserId === recipientUserId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    setUserAccessRole: (userId, accessRole) =>
      setState((current) => ({
        ...current,
        users: current.users.map((user) =>
          user.id === userId ? { ...user, accessRole, permissionOverrides: {} } : user
        ),
      })),
    setPermissionOverride: (userId, permission, enabled) =>
      setState((current) => ({
        ...current,
        users: current.users.map((user) =>
          user.id === userId
            ? { ...user, permissionOverrides: { ...user.permissionOverrides, [permission]: enabled } }
            : user
        ),
      })),
    resetPermissionOverrides: (userId) =>
      setState((current) => ({
        ...current,
        users: current.users.map((user) =>
          user.id === userId ? { ...user, permissionOverrides: {} } : user
        ),
      })),
    resetDemoData: () => setState(seedState()),
  }), [addDriverEvent, createJob, hydrated, state, updateJobStatus]);

  return <DemoStateContext.Provider value={value}>{children}</DemoStateContext.Provider>;
}

export function useDemoState() {
  const value = React.useContext(DemoStateContext);
  if (!value) throw new Error("useDemoState must be used inside DemoStateProvider");
  return value;
}

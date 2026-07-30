/**
 * Data-access layer.
 *
 * The UI imports ONLY from this module — never from `mock-data` directly. Today
 * every function returns seeded mock data synchronously. In the real build each
 * function becomes an async Supabase query with the same signature, so the
 * screens don't change. This is the single seam between the design skeleton and
 * the live backend.
 */
import {
  customers,
  dumpsters,
  absenceEvents,
  invoices,
  jobActivities,
  jobNotes,
  messageThreads,
  jobs,
  messages,
  sopItems,
  timeEntries,
  timeRequests,
  trucks,
  users,
} from "./mock-data";
import type {
  Customer,
  Dumpster,
  Job,
  JobNote,
  Truck,
  User,
} from "./types";

export const getUsers = () => users;
export const getDrivers = () => users.filter((u) => u.role === "driver");
export const getManagers = () => users.filter((u) => u.role === "management");
export const getUser = (id: string): User | undefined =>
  users.find((u) => u.id === id);

export const getCustomers = () => customers;
export const getCustomer = (id: string): Customer | undefined =>
  customers.find((c) => c.id === id);

export const getJobs = () => jobs;
export const getJob = (id: string): Job | undefined =>
  jobs.find((j) => j.id === id || j.reference === id || j.reference === `#${id}`);
export const getJobByReference = (ref: string): Job | undefined =>
  jobs.find((j) => j.reference === ref || j.reference === `#${ref}`);
export const getJobsForDriver = (driverId: string) =>
  jobs.filter((j) => j.assignedDriverId === driverId);

export const getTrucks = () => trucks;
export const getTruck = (id: string): Truck | undefined =>
  trucks.find((t) => t.id === id);

export const getDumpsters = () => dumpsters;
export const getDumpster = (id: string): Dumpster | undefined =>
  dumpsters.find((d) => d.id === id);

export const getJobNotes = (jobId: string): JobNote[] =>
  jobNotes.filter((n) => n.jobId === jobId);
export const getJobActivities = (jobId?: string) =>
  (jobId ? jobActivities.filter((a) => a.jobId === jobId) : jobActivities).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

export const getTimeEntries = () => timeEntries;
export const getTimeRequests = () => timeRequests;
export const getAbsenceEvents = () => absenceEvents;
export const getMessages = () => messages;
export const getMessageThreads = () => messageThreads;
export const getInvoices = () => invoices;
export const getSopItems = () => sopItems;

// ---- Derived / dashboard helpers ----

export function getDashboardStats() {
  return {
    totalToday: jobs.length,
    inProgress: jobs.filter((j) => j.status === "en_route" || j.status === "arrived").length,
    completed: jobs.filter((j) => j.status === "complete").length,
    pending: jobs.filter((j) => j.status === "pending").length,
    driversOnDuty: getDrivers().length,
    trucksInUse: trucks.filter((t) => t.status === "in_use").length,
    dumpstersOut: dumpsters.filter((d) => d.status === "out").length,
  };
}

/** For the demo driver experience, "log in" as Mike Rogers. */
export const CURRENT_DRIVER_ID = "u1";
/** For the demo dispatcher experience. */
export const CURRENT_DISPATCHER_ID = "u5";

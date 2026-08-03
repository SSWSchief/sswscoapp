/**
 * Domain types for the SSWSCO Overwatch operations prototype.
 *
 * These mirror the database tables named in the PRD (§5):
 *   Users, Customers, Jobs, Trucks, Dumpsters, Time Entries, Job Photos, Job Notes.
 *
 * They are written to line up 1:1 with the eventual Supabase/Postgres schema so
 * that the mock data layer can be swapped for real queries with no changes to
 * the UI components that consume them.
 */

export type UserRole = "dispatcher" | "driver" | "office" | "management";

export type AccessRole = "admin" | "dispatcher" | "driver";

export type PermissionKey =
  | "management"
  | "dashboard"
  | "jobs"
  | "customers"
  | "trucks"
  | "dumpsters"
  | "employees"
  | "time_clock"
  | "absence"
  | "invoices"
  | "messages"
  | "map"
  | "reports"
  | "settings"
  | "driver_jobs"
  | "pre_trip"
  | "sops"
  | "profile";

export type JobStatus =
  | "pending"
  | "en_route"
  | "arrived"
  | "complete"
  | "cancelled";

export type TruckStatus = "in_use" | "down" | "in_shop";

export type DumpsterStatus = "out" | "in_yard" | "in_shop";

export type EmployeeStatus = "active" | "inactive";

export type ServiceType =
  | "Delivery"
  | "Pick-Up"
  | "Dump & Return"
  | "Swap / Exchange"
  | "Relocation"
  | "Dry Run"
  | "Service Call";

export type DumpsterSize =
  | "10 Yard"
  | "20 Yard"
  | "30 Yard"
  | "40 Yard";

export interface User {
  id: string;
  employeeId: string;
  fullName: string;
  email: string;
  phone: string;
  role: UserRole;
  accessRole: AccessRole;
  permissionOverrides: Partial<Record<PermissionKey, boolean>>;
  status: EmployeeStatus;
  /** initials shown in avatars when no photo is set */
  initials: string;
  ptoBalanceHours?: number;
  weeklyHours?: number;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  activeJobs: number;
  group?: "Big GC" | "Commercial" | "Residential";
}

export interface Truck {
  id: string;
  number: string; // e.g. "T-03"
  type: string; // e.g. "Roll-off Truck"
  status: TruckStatus;
  licensePlate: string;
  registrationDueDate: string;
  mileage: number;
  lastPmDate: string;
  lastPmMileage: number;
  nextPmDate: string;
  nextPmMileage: number;
  make: string;
  model: string;
  vin: string;
  assignedDriverId: string | null;
  currentJobId: string | null;
  notes: string;
  airTagId?: string | null;
  gpsSource?: "manual" | "airtag" | "gps_placeholder";
  lastKnownLocation?: string;
  lastSeenAt?: string;
}

export interface Dumpster {
  id: string;
  code: string; // e.g. "D-102"
  size: DumpsterSize;
  status: DumpsterStatus;
  type: string; // e.g. "Roll-off"
  currentCustomerId: string | null;
  currentLocation: string; // last known operational location (job address)
  currentJobId: string | null;
  airTagId: string | null;
  notes: string;
}

export interface JobNote {
  id: string;
  jobId: string;
  authorId: string;
  authorName: string;
  body: string;
  createdAt: string; // ISO
}

export interface JobPhoto {
  id: string;
  jobId: string;
  url: string | null; // null = placeholder in skeleton
  uploadedById: string;
  createdAt: string;
}

export type JobEventType =
  | "created"
  | "assigned"
  | "en_route"
  | "arrived"
  | "dry_run"
  | "completed";

export interface JobEvent {
  type: JobEventType;
  at: string | null; // ISO, null = not yet reached
}

export type JobActivityType =
  | "created"
  | "assigned"
  | "en_route"
  | "arrived"
  | "dry_run"
  | "completed"
  | "note";

export interface JobActivity {
  id: string;
  jobId: string;
  actorId: string;
  actorName: string;
  type: JobActivityType;
  body: string;
  createdAt: string;
  dispatchNotified?: boolean;
}

export type NotificationCategory =
  | "job_assignment"
  | "dispatch_update"
  | "driver_status"
  | "dry_run";

export interface AppNotification {
  id: string;
  recipientUserId: string;
  sourceRole: AccessRole;
  category: NotificationCategory;
  title: string;
  body: string;
  relatedJobId: string | null;
  createdAt: string;
  requiresAcknowledgement: boolean;
  acknowledgedAt: string | null;
}

export interface Job {
  id: string;
  reference: string; // e.g. "#1052"
  customerId: string;
  address: string;
  phone: string;
  serviceType: ServiceType;
  dumpsterSize: DumpsterSize;
  assignedDriverId: string | null;
  assignedTruckId: string | null;
  assignedDumpsterId: string | null;
  scheduledFor: string; // ISO datetime
  status: JobStatus;
  notes: string;
  trafficInstructions?: string;
  photos: JobPhoto[];
  timeline: JobEvent[];
}

export type TimeEntryType =
  | "clock_in"
  | "break_start"
  | "break_end"
  | "clock_out";

export interface TimeEntry {
  id: string;
  userId: string;
  type: TimeEntryType;
  at: string; // ISO
}

export interface TimeRequest {
  id: string;
  userId: string;
  kind: "edit_time" | "pto";
  status: "pending" | "approved" | "denied";
  requestedFor: string;
  hours: number;
  reason: string;
}

export interface AbsenceEvent {
  id: string;
  userId: string;
  date: string;
  type: "pto" | "sick" | "unavailable";
  status: "pending" | "approved";
  note: string;
}

export type MessageKind = "message" | "announcement";

export interface CompanyMessage {
  id: string;
  kind: MessageKind;
  title: string;
  body: string;
  createdAt: string;
}

export interface MessageThread {
  id: string;
  channel: "Dispatch" | "Drivers" | "Customer Support" | "Management";
  title: string;
  participants: string[];
  updatedAt: string;
  messages: CompanyMessage[];
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  customerId: string;
  jobId: string | null;
  amount: number;
  status: "draft" | "sent" | "viewed" | "paid" | "overdue" | "closed";
  customerGroup: "Big GC" | "Commercial" | "Residential";
  paymentUrl: string;
  reminderCadence: "none" | "weekly" | "biweekly" | "monthly";
  sentAt: string | null;
  dueAt: string;
  closedAt: string | null;
  methodSource: "manual_link" | "processor_placeholder";
}

export interface SopItem {
  id: string;
  category: "Procedure" | "Safety Review";
  title: string;
  summary: string;
  requiredForDrivers: boolean;
  acknowledgedBy: string[];
  updatedAt: string;
}

/**
 * Domain types for the SSWSCO Overwatch operations platform.
 *
 * These mirror the database tables named in the PRD (§5):
 *   Users, Customers, Jobs, Trucks, Dumpsters, Time Entries, Job Photos, Job Notes.
 *
 * They are written to line up 1:1 with the eventual Supabase/Postgres schema so
 * used by the typed Supabase data layer and operational UI.
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

export type DumpsterSize = "10 Yard" | "20 Yard" | "30 Yard" | "40 Yard";

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
  correctedByRequestId?: string;
  originalEntryId?: string | null;
}

export interface TimeEntryCorrection {
  id: string;
  requestId: string;
  originalEntryId: string | null;
  userId: string;
  replacementType: TimeEntryType;
  replacementAt: string;
}

export interface TimeRequest {
  id: string;
  userId: string;
  kind: "edit_time" | "pto";
  status: "pending" | "approved" | "denied";
  requestedFor: string;
  hours: number;
  reason: string;
  targetEntryId?: string | null;
  requestedEntryType?: TimeEntryType | null;
  requestedAt?: string | null;
}

export interface AbsenceEvent {
  id: string;
  userId: string;
  date: string;
  type: "pto" | "sick" | "unavailable";
  status: "pending" | "approved";
  note: string;
}

export type InvoiceStatus =
  | "draft"
  | "sent"
  | "paid"
  | "overdue"
  | "closed"
  | "void";
export interface InvoiceRecord {
  id: string;
  invoiceNumber: string;
  customerId: string;
  jobId: string | null;
  amountCents: number;
  status: InvoiceStatus;
  dueDate: string;
  notes: string;
  sentAt: string | null;
  paidAt: string | null;
  closedAt: string | null;
  createdAt: string;
}

export interface MessageChannel {
  id: string;
  name: string;
  kind: "channel" | "direct" | "announcement";
  createdAt: string;
}
export interface TeamMessage {
  id: string;
  channelId: string;
  senderId: string;
  body: string;
  createdAt: string;
  read: boolean;
}

export interface PretripTemplateItem {
  id: string;
  label: string;
  description?: string;
}
export interface PretripTemplate {
  id: string;
  title: string;
  version: number;
  isPublished: boolean;
  items: PretripTemplateItem[];
}
export interface PretripSubmission {
  id: string;
  templateId: string;
  driverId: string;
  truckId: string;
  mileage: number;
  signature: string;
  results: Record<string, "pass" | "fail">;
  hasFailures: boolean;
  submittedAt: string;
}

export interface SopDocument {
  id: string;
  title: string;
  category: string;
  version: number;
  body: string;
  isPublished: boolean;
  requiredForDrivers: boolean;
  createdAt: string;
  acknowledged: boolean;
}
export interface CompanySettings {
  companyName: string;
  address: string;
  phone: string;
  email: string;
  timeZone: string;
  dateFormat: string;
  messageRetentionDays: number;
  invoicePrefix: string;
}

export type TrainingDatasetStatus = "not_provisioned" | "active" | "removed";

export interface TrainingDataset {
  datasetKey: "training-v1";
  status: TrainingDatasetStatus;
  recordIds: Partial<{
    customerId: string;
    truckId: string;
    dumpsterId: string;
    jobId: string;
    invoiceId: string;
  }>;
  createdAt?: string;
  removedAt?: string;
}

export interface TrainingDatasetMutation {
  datasetKey: "training-v1";
  status: "active" | "removed";
  idempotent: boolean;
  createdCounts?: Record<string, number>;
  deletedCounts?: Record<string, number>;
}

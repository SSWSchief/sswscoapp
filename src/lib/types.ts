/**
 * Domain types for the SSWS Internal Operations Platform (Phase 1).
 *
 * These mirror the database tables named in the PRD (§5):
 *   Users, Customers, Jobs, Trucks, Dumpsters, Time Entries, Job Photos, Job Notes.
 *
 * They are written to line up 1:1 with the eventual Supabase/Postgres schema so
 * that the mock data layer can be swapped for real queries with no changes to
 * the UI components that consume them.
 */

export type UserRole = "dispatcher" | "driver" | "office";

export type JobStatus =
  | "pending"
  | "in_progress"
  | "completed"
  | "cancelled";

export type TruckStatus = "in_use" | "in_shop" | "available";

export type DumpsterStatus = "out" | "in_yard" | "in_shop";

export type EmployeeStatus = "active" | "inactive";

export type ServiceType =
  | "Dumpster Drop Off"
  | "Dumpster Pickup"
  | "Dumpster Swap"
  | "Roll-off Delivery";

export type DumpsterSize =
  | "10 Yard"
  | "20 Yard"
  | "30 Yard"
  | "40 Yard";

export interface User {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  role: UserRole;
  status: EmployeeStatus;
  /** initials shown in avatars when no photo is set */
  initials: string;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  activeJobs: number;
}

export interface Truck {
  id: string;
  number: string; // e.g. "T-03"
  type: string; // e.g. "Roll-off Truck"
  status: TruckStatus;
  licensePlate: string;
  assignedDriverId: string | null;
  currentJobId: string | null;
  notes: string;
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
  | "started"
  | "completed";

export interface JobEvent {
  type: JobEventType;
  at: string | null; // ISO, null = not yet reached
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

export type MessageKind = "message" | "announcement";

export interface CompanyMessage {
  id: string;
  kind: MessageKind;
  title: string;
  body: string;
  createdAt: string;
}

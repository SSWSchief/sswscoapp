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
  | "vendors"
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
  /** Object key of their photo in the private bucket, when they have one. */
  avatarPath?: string | null;
  /**
   * Signed URL for `avatarPath`, resolved by the operations provider. Absent
   * until it has been, and short-lived once it has — every avatar falls back
   * to initials rather than showing a broken image.
   */
  avatarUrl?: string;
  /**
   * First sign-in. Null means the account has been created but never used —
   * the employee is Pending, not Active. See `@/lib/employee-status`.
   */
  activatedAt?: string | null;
  ptoBalanceHours?: number;
  weeklyHours?: number;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  billingContactName: string;
  billingEmail: string;
  billingAddressLine1: string;
  billingAddressLine2: string;
  billingCity: string;
  billingState: string;
  billingPostalCode: string;
  billingCountry: "US";
  activeJobs: number;
  group?: "Big GC" | "Commercial" | "Residential";
}

export interface Vendor {
  id: string;
  name: string;
  category: string;
  phone: string;
  email: string;
  notes: string;
  isActive: boolean;
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
  /** The representative who brought in the work, for tracking and bonuses. */
  salesRepId: string | null;
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
  | "open"
  | "paid"
  | "uncollectible"
  | "void";
export type InvoiceDisplayStatus =
  | InvoiceStatus
  | "overdue"
  | "processing"
  | "payment_failed"
  | "partially_paid";
export type InvoiceBillingMode = "per_job" | "statement";
export type InvoicePaymentTerms = "due_on_receipt" | "net_15" | "net_30";
export type InvoiceSyncState =
  | "not_started"
  | "processing"
  | "synced"
  | "failed";
export type InvoiceLineCategory =
  | "service"
  | "rental"
  | "tonnage"
  | "fee"
  | "surcharge"
  | "adjustment";
export interface InvoiceLineItem {
  id: string;
  invoiceId: string;
  description: string;
  amountCents: number;
  position: number;
  jobId: string | null;
  category: InvoiceLineCategory;
}
export interface InvoiceDraftItem {
  description: string;
  amountCents: number;
  jobId?: string | null;
  category: InvoiceLineCategory;
}
export interface InvoiceDraftInput {
  customerId: string;
  billingMode: InvoiceBillingMode;
  jobIds: string[];
  paymentTerms: InvoicePaymentTerms;
  poNumber: string;
  notes: string;
  items: InvoiceDraftItem[];
}
export interface InvoiceRecord {
  id: string;
  invoiceNumber: string;
  customerId: string;
  jobId: string | null;
  jobIds: string[];
  lineItems: InvoiceLineItem[];
  amountCents: number;
  status: InvoiceStatus;
  displayStatus: InvoiceDisplayStatus;
  billingMode: InvoiceBillingMode;
  paymentTerms: InvoicePaymentTerms;
  dueDate: string | null;
  notes: string;
  poNumber: string;
  billingContactName: string;
  billingEmail: string;
  billingAddressLine1: string;
  billingAddressLine2: string;
  billingCity: string;
  billingState: string;
  billingPostalCode: string;
  billingCountry: "US";
  /** Set once the invoice has been raised in Stripe; null means never sent. */
  stripeInvoiceId: string | null;
  hostedInvoiceUrl: string | null;
  invoicePdfUrl: string | null;
  amountPaidCents: number;
  amountRemainingCents: number;
  stripeSyncState: InvoiceSyncState;
  stripeSyncError: string | null;
  paymentProcessingAt: string | null;
  paymentFailedAt: string | null;
  issuedAt: string | null;
  revisedFromId: string | null;
  latestRevisionId: string | null;
  sentAt: string | null;
  paidAt: string | null;
  closedAt: string | null;
  createdAt: string;
}

/**
 * A scale ticket for one haul, in pounds exactly as written at the disposal
 * site. Tons are derived where they are needed rather than stored, so the
 * figure on the paper is always what the database holds.
 */
export interface DisposalTicket {
  id: string;
  jobId: string;
  ticketNumber: string;
  vendorId: string | null;
  grossWeightLbs: number | null;
  tareWeightLbs: number | null;
  netWeightLbs: number;
  weighedAt: string;
  storagePath: string | null;
  notes: string;
  recordedById: string | null;
  createdAt: string;
}

/**
 * One container standing at one jobsite, from the delivery that put it there
 * to the pick-up that brought it back. `retrievedAt` of null means it is still
 * out; billable rental days are the span between the two.
 */
export interface ContainerPlacement {
  id: string;
  customerId: string;
  dumpsterId: string;
  address: string;
  deliveredJobId: string | null;
  retrievedJobId: string | null;
  deliveredAt: string;
  retrievedAt: string | null;
  notes: string;
}

/** A reference rate for one service and container size. */
export interface PriceListItem {
  id: string;
  serviceType: ServiceType;
  dumpsterSize: DumpsterSize;
  priceCents: number;
  notes: string;
  updatedAt: string;
}

/**
 * Acknowledgement state for one person. `acknowledgedAt` is null when the
 * person still owes an acknowledgement, which is the case staff care about.
 */
export interface AcknowledgementEntry {
  userId: string;
  fullName: string;
  acknowledgedAt: string | null;
}

export interface ReadReceiptEntry {
  userId: string;
  fullName: string;
  readAt: string;
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
  /** Rental terms printed on every invoice. See 202609010005. */
  invoiceTerms: string;
  defaultPaymentTerms: InvoicePaymentTerms;
  taxPolicyStatus: "pending" | "non_taxable_approved" | "follow_up_required";
  taxPolicyApprovedAt: string | null;
  taxPolicyNote: string;
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

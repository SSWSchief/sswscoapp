import type {
  CompanyMessage,
  AppNotification,
  Customer,
  Dumpster,
  Invoice,
  Job,
  JobActivity,
  JobNote,
  MessageThread,
  SopItem,
  AbsenceEvent,
  TimeEntry,
  TimeRequest,
  Truck,
  User,
} from "./types";

/**
 * Seed data for the design skeleton. Values mirror the wireframes so the
 * screens read as intended during a client walkthrough. This whole module is
 * replaced by Supabase queries in the real build — nothing here reaches the DB.
 */

// A fixed "today" so the mock timeline is deterministic in the skeleton.
const TODAY = "2024-05-15";
const iso = (time: string) => `${TODAY}T${time}:00`;

export const users: User[] = [
  { id: "u1", employeeId: "SSW-1001", fullName: "Mike Rogers", email: "mike@ssws.com", phone: "(702) 555-0101", role: "driver", accessRole: "driver", permissionOverrides: {}, status: "active", initials: "MR", ptoBalanceHours: 32, weeklyHours: 34.5 },
  { id: "u2", employeeId: "SSW-1002", fullName: "Jake Smith", email: "jake@ssws.com", phone: "(702) 555-0102", role: "driver", accessRole: "driver", permissionOverrides: {}, status: "active", initials: "JS", ptoBalanceHours: 18, weeklyHours: 36.25 },
  { id: "u3", employeeId: "SSW-1003", fullName: "Tony Davis", email: "tony@ssws.com", phone: "(702) 555-0103", role: "driver", accessRole: "driver", permissionOverrides: {}, status: "active", initials: "TD", ptoBalanceHours: 24, weeklyHours: 31.75 },
  { id: "u4", employeeId: "SSW-1004", fullName: "Chris Martinez", email: "chris@ssws.com", phone: "(702) 555-0104", role: "driver", accessRole: "driver", permissionOverrides: {}, status: "active", initials: "CM", ptoBalanceHours: 40, weeklyHours: 28 },
  { id: "u5", employeeId: "SSW-2001", fullName: "Sarah Johnson", email: "sarah@ssws.com", phone: "(702) 555-0201", role: "dispatcher", accessRole: "dispatcher", permissionOverrides: {}, status: "active", initials: "SJ" },
  { id: "u6", employeeId: "SSW-2002", fullName: "Daniel Perez", email: "daniel@ssws.com", phone: "(702) 555-0202", role: "dispatcher", accessRole: "dispatcher", permissionOverrides: {}, status: "active", initials: "DP" },
  { id: "u7", employeeId: "SSW-3001", fullName: "Lisa Wong", email: "lisa@ssws.com", phone: "(702) 555-0203", role: "office", accessRole: "admin", permissionOverrides: {}, status: "active", initials: "LW" },
  { id: "u8", employeeId: "SSW-3002", fullName: "Austin Marshall", email: "austin@sswsco.com", phone: "(702) 460-0726", role: "management", accessRole: "admin", permissionOverrides: {}, status: "active", initials: "AM" },
];

export const customers: Customer[] = [
  { id: "c1", name: "ABC Construction", phone: "(702) 555-0134", email: "info@abcbuild.com", address: "123 Main St, Las Vegas, NV 89101", activeJobs: 2, group: "Big GC" },
  { id: "c2", name: "Sunset Development", phone: "(702) 555-0198", email: "dispatch@sunsetdev.com", address: "456 Desert Rd, Las Vegas, NV 89107", activeJobs: 1, group: "Commercial" },
  { id: "c3", name: "Green Valley Ranch", phone: "(702) 555-0147", email: "office@gvranch.com", address: "789 Horizon Dr, Henderson, NV 89052", activeJobs: 1, group: "Residential" },
  { id: "c4", name: "BuildRight LLC", phone: "(702) 555-0177", email: "admin@buildright.com", address: "321 Boulder Hwy, Henderson, NV 89011", activeJobs: 0, group: "Commercial" },
  { id: "c5", name: "Nevada Retail", phone: "(702) 555-0188", email: "ops@nevadaretail.com", address: "654 Commerce St, Las Vegas, NV 89109", activeJobs: 1, group: "Commercial" },
  { id: "c6", name: "Desert Contractors", phone: "(702) 555-0122", email: "info@desertcontractors.com", address: "987 Sahara Ave, Las Vegas, NV 89104", activeJobs: 0, group: "Big GC" },
];

export const trucks: Truck[] = [
  { id: "t1", number: "T-01", type: "Roll-off Truck", status: "in_use", licensePlate: "NV-88101", registrationDueDate: "2026-11-30", mileage: 68420, lastPmDate: "2026-06-18", lastPmMileage: 65000, nextPmDate: "2026-09-18", nextPmMileage: 70000, make: "Mack", model: "Granite", vin: "1M2GR2GC6LM012101", assignedDriverId: "u3", currentJobId: "j5", notes: "Roll-off truck", airTagId: "AT-TRK-01", gpsSource: "airtag", lastKnownLocation: "654 Commerce St, Las Vegas", lastSeenAt: iso("15:12") },
  { id: "t2", number: "T-02", type: "Roll-off Truck", status: "down", licensePlate: "NV-88102", registrationDueDate: "2027-01-15", mileage: 92115, lastPmDate: "2026-07-02", lastPmMileage: 90000, nextPmDate: "2026-10-02", nextPmMileage: 95000, make: "Peterbilt", model: "567", vin: "1XPCDP9X7LD712202", assignedDriverId: null, currentJobId: null, notes: "Down pending hydraulic inspection", airTagId: "AT-TRK-02", gpsSource: "manual", lastKnownLocation: "Yard", lastSeenAt: iso("13:05") },
  { id: "t3", number: "T-03", type: "Roll-off Truck", status: "in_use", licensePlate: "NV-88103", registrationDueDate: "2026-12-20", mileage: 54880, lastPmDate: "2026-05-28", lastPmMileage: 52000, nextPmDate: "2026-08-28", nextPmMileage: 57000, make: "Kenworth", model: "T880", vin: "1XKZD40X9LJ301303", assignedDriverId: "u1", currentJobId: "j2", notes: "", airTagId: "AT-TRK-03", gpsSource: "gps_placeholder", lastKnownLocation: "456 Desert Rd, Las Vegas", lastSeenAt: iso("09:42") },
  { id: "t4", number: "T-04", type: "Roll-off Truck", status: "in_shop", licensePlate: "NV-88104", registrationDueDate: "2026-10-08", mileage: 105330, lastPmDate: "2026-07-29", lastPmMileage: 105000, nextPmDate: "2026-10-29", nextPmMileage: 110000, make: "Mack", model: "Granite", vin: "1M2GR2GC8KM014404", assignedDriverId: null, currentJobId: null, notes: "Oil change", airTagId: "AT-TRK-04", gpsSource: "manual", lastKnownLocation: "Yard", lastSeenAt: iso("07:20") },
  { id: "t5", number: "T-05", type: "Roll-off Truck", status: "in_use", licensePlate: "NV-88105", registrationDueDate: "2027-02-14", mileage: 39740, lastPmDate: "2026-06-30", lastPmMileage: 37000, nextPmDate: "2026-09-30", nextPmMileage: 42000, make: "Peterbilt", model: "567", vin: "1XPCDP9X5MD715505", assignedDriverId: "u2", currentJobId: "j1", notes: "", airTagId: "AT-TRK-05", gpsSource: "airtag", lastKnownLocation: "123 Main St, Las Vegas", lastSeenAt: iso("08:24") },
];

export const dumpsters: Dumpster[] = [
  { id: "d1", code: "D-101", size: "20 Yard", status: "out", type: "Roll-off", currentCustomerId: "c3", currentLocation: "789 Horizon Dr, Henderson", currentJobId: "j2", airTagId: "AT-3FBK", notes: "" },
  { id: "d2", code: "D-102", size: "30 Yard", status: "out", type: "Roll-off", currentCustomerId: "c1", currentLocation: "123 Main St, Las Vegas", currentJobId: "j1", airTagId: "AT-7H2L", notes: "" },
  { id: "d3", code: "D-103", size: "30 Yard", status: "in_yard", type: "Roll-off", currentCustomerId: null, currentLocation: "Yard", currentJobId: null, airTagId: "AT-9P1M", notes: "" },
  { id: "d4", code: "D-104", size: "40 Yard", status: "out", type: "Roll-off", currentCustomerId: "c2", currentLocation: "456 Desert Rd, Las Vegas", currentJobId: null, airTagId: "AT-2K7J", notes: "" },
  { id: "d5", code: "D-105", size: "20 Yard", status: "out", type: "Roll-off", currentCustomerId: "c4", currentLocation: "321 Boulder Hwy, Henderson", currentJobId: "j4", airTagId: "AT-8L3P", notes: "Back gate. Call upon arrival." },
];

export const jobs: Job[] = [
  {
    id: "j1",
    reference: "#1052",
    customerId: "c1",
    address: "123 Main St, Las Vegas, NV 89101",
    phone: "(702) 555-0134",
    serviceType: "Delivery",
    dumpsterSize: "30 Yard",
    assignedDriverId: "u1",
    assignedTruckId: "t3",
    assignedDumpsterId: "d2",
    scheduledFor: iso("08:00"),
    status: "arrived",
    notes: "Place in construction area. Call upon arrival.",
    trafficInstructions: "Gate code 1234. Enter from rear of property.",
    photos: [
      { id: "p1", jobId: "j1", url: null, uploadedById: "u1", createdAt: iso("08:20") },
      { id: "p2", jobId: "j1", url: null, uploadedById: "u1", createdAt: iso("08:22") },
      { id: "p3", jobId: "j1", url: null, uploadedById: "u1", createdAt: iso("08:23") },
    ],
    timeline: [
      { type: "created", at: iso("07:45") },
      { type: "assigned", at: iso("07:48") },
      { type: "en_route", at: iso("07:58") },
      { type: "arrived", at: iso("08:05") },
      { type: "completed", at: null },
    ],
  },
  {
    id: "j2",
    reference: "#1053",
    customerId: "c2",
    address: "456 Desert Rd, Las Vegas, NV 89107",
    phone: "(702) 555-0198",
    serviceType: "Delivery",
    dumpsterSize: "20 Yard",
    assignedDriverId: "u2",
    assignedTruckId: "t3",
    assignedDumpsterId: "d1",
    scheduledFor: iso("09:30"),
    status: "en_route",
    notes: "Leave near loading dock.",
    photos: [],
    timeline: [
      { type: "created", at: iso("07:50") },
      { type: "assigned", at: iso("07:55") },
      { type: "en_route", at: iso("09:35") },
      { type: "arrived", at: null },
      { type: "completed", at: null },
    ],
  },
  {
    id: "j3",
    reference: "#1054",
    customerId: "c3",
    address: "789 Horizon Dr, Henderson, NV 89052",
    phone: "(702) 555-0147",
    serviceType: "Swap / Exchange",
    dumpsterSize: "30 Yard",
    assignedDriverId: "u1",
    assignedTruckId: "t3",
    assignedDumpsterId: "d1",
    scheduledFor: iso("11:00"),
    status: "pending",
    notes: "Swap full unit for empty.",
    photos: [],
    timeline: [
      { type: "created", at: iso("08:10") },
      { type: "assigned", at: iso("08:12") },
      { type: "en_route", at: null },
      { type: "arrived", at: null },
      { type: "completed", at: null },
    ],
  },
  {
    id: "j4",
    reference: "#1055",
    customerId: "c4",
    address: "321 Boulder Hwy, Henderson, NV 89011",
    phone: "(702) 555-0177",
    serviceType: "Pick-Up",
    dumpsterSize: "20 Yard",
    assignedDriverId: "u3",
    assignedTruckId: "t2",
    assignedDumpsterId: "d5",
    scheduledFor: iso("13:00"),
    status: "pending",
    notes: "Back gate. Call upon arrival.",
    photos: [],
    timeline: [
      { type: "created", at: iso("08:30") },
      { type: "assigned", at: null },
      { type: "en_route", at: null },
      { type: "arrived", at: null },
      { type: "completed", at: null },
    ],
  },
  {
    id: "j5",
    reference: "#1051",
    customerId: "c5",
    address: "654 Commerce St, Las Vegas, NV 89109",
    phone: "(702) 555-0188",
    serviceType: "Pick-Up",
    dumpsterSize: "20 Yard",
    assignedDriverId: "u2",
    assignedTruckId: "t5",
    assignedDumpsterId: null,
    scheduledFor: iso("14:30"),
    status: "complete",
    notes: "",
    photos: [{ id: "p4", jobId: "j5", url: null, uploadedById: "u2", createdAt: iso("15:10") }],
    timeline: [
      { type: "created", at: iso("07:30") },
      { type: "assigned", at: iso("07:35") },
      { type: "en_route", at: iso("14:30") },
      { type: "arrived", at: iso("14:52") },
      { type: "completed", at: iso("15:12") },
    ],
  },
];

export const jobNotes: JobNote[] = [
  { id: "n1", jobId: "j1", authorId: "u1", authorName: "Mike R.", body: "Arrived on site. Customer present.", createdAt: iso("08:05") },
  { id: "n2", jobId: "j1", authorId: "u1", authorName: "Mike R.", body: "Dumpster placed in designated area.", createdAt: iso("08:20") },
  { id: "n3", jobId: "j1", authorId: "u5", authorName: "Dispatch", body: "Dumpster drop off at rear of property. Gate code 1234.", createdAt: iso("07:48") },
];

export const jobActivities: JobActivity[] = [
  { id: "a1", jobId: "j1", actorId: "u5", actorName: "Dispatch", type: "created", body: "Job created and assigned to Mike Rogers.", createdAt: iso("07:45") },
  { id: "a2", jobId: "j1", actorId: "u1", actorName: "Mike R.", type: "en_route", body: "Driver marked en route.", createdAt: iso("07:58"), dispatchNotified: true },
  { id: "a3", jobId: "j1", actorId: "u1", actorName: "Mike R.", type: "arrived", body: "Driver arrived on site.", createdAt: iso("08:05"), dispatchNotified: true },
  { id: "a4", jobId: "j2", actorId: "u2", actorName: "Jake S.", type: "en_route", body: "Driver marked en route to Sunset Development.", createdAt: iso("09:35"), dispatchNotified: true },
  { id: "a5", jobId: "j5", actorId: "u2", actorName: "Jake S.", type: "completed", body: "Pick-Up completed and photos submitted.", createdAt: iso("15:12"), dispatchNotified: true },
  { id: "a6", jobId: "j4", actorId: "u3", actorName: "Tony D.", type: "dry_run", body: "Dry run requested: access blocked by locked rear gate.", createdAt: iso("13:22"), dispatchNotified: true },
];

export const timeEntries: TimeEntry[] = [
  { id: "te1", userId: "u1", type: "clock_in", at: iso("07:30") },
  { id: "te2", userId: "u1", type: "break_start", at: iso("10:00") },
  { id: "te3", userId: "u1", type: "break_end", at: iso("10:15") },
];

export const timeRequests: TimeRequest[] = [
  { id: "tr1", userId: "u1", kind: "edit_time", status: "pending", requestedFor: TODAY, hours: 0.5, reason: "Forgot to clock in after early dispatch call." },
  { id: "tr2", userId: "u2", kind: "pto", status: "approved", requestedFor: "2024-05-24", hours: 8, reason: "PTO Friday before holiday weekend." },
];

export const absenceEvents: AbsenceEvent[] = [
  { id: "ab1", userId: "u2", date: "2024-05-24", type: "pto", status: "approved", note: "Approved PTO" },
  { id: "ab2", userId: "u4", date: "2024-05-16", type: "unavailable", status: "pending", note: "Doctor appointment, afternoon" },
  { id: "ab3", userId: "u1", date: "2024-05-17", type: "pto", status: "pending", note: "Half-day request" },
];

export const messages: CompanyMessage[] = [
  { id: "m1", kind: "announcement", title: "New Policy Update", body: "Please review the new safety policy. Effective immediately.", createdAt: iso("07:30") },
  { id: "m2", kind: "announcement", title: "Holiday Schedule", body: "Office will be closed on Monday, May 27.", createdAt: iso("09:15") },
  { id: "m3", kind: "announcement", title: "Equipment Maintenance", body: "T-02 will be out of service on May 20 for maintenance.", createdAt: iso("15:45") },
  { id: "m4", kind: "announcement", title: "Training Reminder", body: "Safety meeting this Friday at 8:00 AM.", createdAt: iso("11:00") },
];

export const appNotifications: AppNotification[] = [
  {
    id: "alert-driver-1",
    recipientUserId: "u1",
    sourceRole: "dispatcher",
    category: "dispatch_update",
    title: "Dispatch update for #1054",
    body: "Use the rear entrance. The customer confirmed the gate code is 1234.",
    relatedJobId: "j3",
    createdAt: new Date(Date.now() - 12 * 60_000).toISOString(),
    requiresAcknowledgement: true,
    acknowledgedAt: null,
  },
  {
    id: "alert-dispatch-1",
    recipientUserId: "u5",
    sourceRole: "driver",
    category: "driver_status",
    title: "Mike R. arrived",
    body: "Job #1052 was marked Arrived. Dispatch acknowledgement requested.",
    relatedJobId: "j1",
    createdAt: new Date(Date.now() - 7 * 60_000).toISOString(),
    requiresAcknowledgement: true,
    acknowledgedAt: null,
  },
];

export const messageThreads: MessageThread[] = [
  {
    id: "mt1",
    channel: "Dispatch",
    title: "Gate access and dry run updates",
    participants: ["u1", "u3", "u5", "u6"],
    updatedAt: iso("13:22"),
    messages: [
      { id: "mt1-1", kind: "message", title: "Dispatch", body: "Please log dry runs immediately so billing can review.", createdAt: iso("12:50") },
      { id: "mt1-2", kind: "message", title: "Tony D.", body: "Job #1055 rear gate was locked. Dry run logged.", createdAt: iso("13:22") },
    ],
  },
  {
    id: "mt2",
    channel: "Drivers",
    title: "Morning route notes",
    participants: ["u1", "u2", "u3", "u4"],
    updatedAt: iso("07:30"),
    messages: [
      { id: "mt2-1", kind: "announcement", title: "Sarah J.", body: "Use Decatur for west side jobs. Strip traffic is heavy.", createdAt: iso("07:30") },
    ],
  },
  {
    id: "mt3",
    channel: "Management",
    title: "Invoice reminders",
    participants: ["u7", "u8"],
    updatedAt: iso("10:40"),
    messages: [
      { id: "mt3-1", kind: "message", title: "Lisa W.", body: "ABC and Nevada Retail reminders are queued for Friday.", createdAt: iso("10:40") },
    ],
  },
];

export const invoices: Invoice[] = [
  { id: "inv1", invoiceNumber: "INV-24051", customerId: "c1", jobId: "j1", amount: 1250, status: "sent", customerGroup: "Big GC", paymentUrl: "https://pay.sswsco.com/inv-24051", reminderCadence: "weekly", sentAt: iso("09:00"), dueAt: "2024-05-29", closedAt: null, methodSource: "manual_link" },
  { id: "inv2", invoiceNumber: "INV-24047", customerId: "c5", jobId: "j5", amount: 625, status: "paid", customerGroup: "Commercial", paymentUrl: "https://pay.sswsco.com/inv-24047", reminderCadence: "none", sentAt: "2024-05-10T09:00:00", dueAt: "2024-05-20", closedAt: iso("15:30"), methodSource: "manual_link" },
  { id: "inv3", invoiceNumber: "INV-24039", customerId: "c3", jobId: "j3", amount: 475, status: "overdue", customerGroup: "Residential", paymentUrl: "https://pay.sswsco.com/inv-24039", reminderCadence: "weekly", sentAt: "2024-05-01T09:00:00", dueAt: "2024-05-12", closedAt: null, methodSource: "processor_placeholder" },
  { id: "inv4", invoiceNumber: "INV-24052", customerId: "c2", jobId: "j2", amount: 780, status: "draft", customerGroup: "Commercial", paymentUrl: "https://pay.sswsco.com/inv-24052", reminderCadence: "biweekly", sentAt: null, dueAt: "2024-06-01", closedAt: null, methodSource: "processor_placeholder" },
];

export const sopItems: SopItem[] = [
  { id: "sop1", category: "Procedure", title: "Roll-Off Drop Procedure", summary: "Confirm placement, take approach photo, set unit, capture completion photo.", requiredForDrivers: true, acknowledgedBy: ["u1", "u2"], updatedAt: "2024-05-10T08:00:00" },
  { id: "sop2", category: "Safety Review", title: "Spotter and Overhead Clearance", summary: "Review clearance checks before entering alleys, loading docks, or sites with overhead lines.", requiredForDrivers: true, acknowledgedBy: ["u1"], updatedAt: "2024-05-13T08:00:00" },
  { id: "sop3", category: "Procedure", title: "Dry Run Documentation", summary: "Log dry runs from the job screen, add photos where possible, and note access issue.", requiredForDrivers: true, acknowledgedBy: ["u3"], updatedAt: "2024-05-14T08:00:00" },
];

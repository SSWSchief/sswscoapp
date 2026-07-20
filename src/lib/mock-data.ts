import type {
  CompanyMessage,
  Customer,
  Dumpster,
  Job,
  JobNote,
  TimeEntry,
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
  { id: "u1", fullName: "Mike Rogers", email: "mike@ssws.com", phone: "(702) 555-0101", role: "driver", status: "active", initials: "MR" },
  { id: "u2", fullName: "Jake Smith", email: "jake@ssws.com", phone: "(702) 555-0102", role: "driver", status: "active", initials: "JS" },
  { id: "u3", fullName: "Tony Davis", email: "tony@ssws.com", phone: "(702) 555-0103", role: "driver", status: "active", initials: "TD" },
  { id: "u4", fullName: "Chris Martinez", email: "chris@ssws.com", phone: "(702) 555-0104", role: "driver", status: "active", initials: "CM" },
  { id: "u5", fullName: "Sarah Johnson", email: "sarah@ssws.com", phone: "(702) 555-0201", role: "dispatcher", status: "active", initials: "SJ" },
  { id: "u6", fullName: "Daniel Perez", email: "daniel@ssws.com", phone: "(702) 555-0202", role: "dispatcher", status: "active", initials: "DP" },
  { id: "u7", fullName: "Lisa Wong", email: "lisa@ssws.com", phone: "(702) 555-0203", role: "office", status: "active", initials: "LW" },
];

export const customers: Customer[] = [
  { id: "c1", name: "ABC Construction", phone: "(702) 555-0134", email: "info@abcbuild.com", address: "123 Main St, Las Vegas, NV 89101", activeJobs: 2 },
  { id: "c2", name: "Sunset Development", phone: "(702) 555-0198", email: "dispatch@sunsetdev.com", address: "456 Desert Rd, Las Vegas, NV 89107", activeJobs: 1 },
  { id: "c3", name: "Green Valley Ranch", phone: "(702) 555-0147", email: "office@gvranch.com", address: "789 Horizon Dr, Henderson, NV 89052", activeJobs: 1 },
  { id: "c4", name: "BuildRight LLC", phone: "(702) 555-0177", email: "admin@buildright.com", address: "321 Boulder Hwy, Henderson, NV 89011", activeJobs: 0 },
  { id: "c5", name: "Nevada Retail", phone: "(702) 555-0188", email: "ops@nevadaretail.com", address: "654 Commerce St, Las Vegas, NV 89109", activeJobs: 1 },
  { id: "c6", name: "Desert Contractors", phone: "(702) 555-0122", email: "info@desertcontractors.com", address: "987 Sahara Ave, Las Vegas, NV 89104", activeJobs: 0 },
];

export const trucks: Truck[] = [
  { id: "t1", number: "T-01", type: "Roll-off Truck", status: "in_use", licensePlate: "NV-88101", assignedDriverId: "u3", currentJobId: "j5", notes: "Roll-off truck" },
  { id: "t2", number: "T-02", type: "Roll-off Truck", status: "in_use", licensePlate: "NV-88102", assignedDriverId: "u2", currentJobId: "j4", notes: "" },
  { id: "t3", number: "T-03", type: "Roll-off Truck", status: "in_use", licensePlate: "NV-88103", assignedDriverId: "u1", currentJobId: "j2", notes: "" },
  { id: "t4", number: "T-04", type: "Roll-off Truck", status: "in_shop", licensePlate: "NV-88104", assignedDriverId: null, currentJobId: null, notes: "Oil change" },
  { id: "t5", number: "T-05", type: "Roll-off Truck", status: "in_use", licensePlate: "NV-88105", assignedDriverId: "u2", currentJobId: "j1", notes: "" },
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
    serviceType: "Dumpster Drop Off",
    dumpsterSize: "30 Yard",
    assignedDriverId: "u1",
    assignedTruckId: "t3",
    assignedDumpsterId: "d2",
    scheduledFor: iso("08:00"),
    status: "in_progress",
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
      { type: "started", at: iso("08:05") },
      { type: "completed", at: null },
    ],
  },
  {
    id: "j2",
    reference: "#1053",
    customerId: "c2",
    address: "456 Desert Rd, Las Vegas, NV 89107",
    phone: "(702) 555-0198",
    serviceType: "Dumpster Drop Off",
    dumpsterSize: "20 Yard",
    assignedDriverId: "u2",
    assignedTruckId: "t3",
    assignedDumpsterId: "d1",
    scheduledFor: iso("09:30"),
    status: "in_progress",
    notes: "Leave near loading dock.",
    photos: [],
    timeline: [
      { type: "created", at: iso("07:50") },
      { type: "assigned", at: iso("07:55") },
      { type: "started", at: iso("09:35") },
      { type: "completed", at: null },
    ],
  },
  {
    id: "j3",
    reference: "#1054",
    customerId: "c3",
    address: "789 Horizon Dr, Henderson, NV 89052",
    phone: "(702) 555-0147",
    serviceType: "Dumpster Swap",
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
      { type: "started", at: null },
      { type: "completed", at: null },
    ],
  },
  {
    id: "j4",
    reference: "#1055",
    customerId: "c4",
    address: "321 Boulder Hwy, Henderson, NV 89011",
    phone: "(702) 555-0177",
    serviceType: "Dumpster Pickup",
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
      { type: "started", at: null },
      { type: "completed", at: null },
    ],
  },
  {
    id: "j5",
    reference: "#1051",
    customerId: "c5",
    address: "654 Commerce St, Las Vegas, NV 89109",
    phone: "(702) 555-0188",
    serviceType: "Dumpster Pickup",
    dumpsterSize: "20 Yard",
    assignedDriverId: "u2",
    assignedTruckId: "t5",
    assignedDumpsterId: null,
    scheduledFor: iso("14:30"),
    status: "completed",
    notes: "",
    photos: [{ id: "p4", jobId: "j5", url: null, uploadedById: "u2", createdAt: iso("15:10") }],
    timeline: [
      { type: "created", at: iso("07:30") },
      { type: "assigned", at: iso("07:35") },
      { type: "started", at: iso("14:30") },
      { type: "completed", at: iso("15:12") },
    ],
  },
];

export const jobNotes: JobNote[] = [
  { id: "n1", jobId: "j1", authorId: "u1", authorName: "Mike R.", body: "Arrived on site. Customer present.", createdAt: iso("08:05") },
  { id: "n2", jobId: "j1", authorId: "u1", authorName: "Mike R.", body: "Dumpster placed in designated area.", createdAt: iso("08:20") },
  { id: "n3", jobId: "j1", authorId: "u5", authorName: "Dispatch", body: "Dumpster drop off at rear of property. Gate code 1234.", createdAt: iso("07:48") },
];

export const timeEntries: TimeEntry[] = [
  { id: "te1", userId: "u1", type: "clock_in", at: iso("07:30") },
  { id: "te2", userId: "u1", type: "break_start", at: iso("10:00") },
  { id: "te3", userId: "u1", type: "break_end", at: iso("10:15") },
];

export const messages: CompanyMessage[] = [
  { id: "m1", kind: "announcement", title: "New Policy Update", body: "Please review the new safety policy. Effective immediately.", createdAt: iso("07:30") },
  { id: "m2", kind: "announcement", title: "Holiday Schedule", body: "Office will be closed on Monday, May 27.", createdAt: iso("09:15") },
  { id: "m3", kind: "announcement", title: "Equipment Maintenance", body: "T-02 will be out of service on May 20 for maintenance.", createdAt: iso("15:45") },
  { id: "m4", kind: "announcement", title: "Training Reminder", body: "Safety meeting this Friday at 8:00 AM.", createdAt: iso("11:00") },
];

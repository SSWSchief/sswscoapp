import type {
  DumpsterStatus,
  JobStatus,
  TruckStatus,
} from "./types";

export function cn(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

export function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatDateTime(iso: string): string {
  return `${formatDate(iso)} ${formatTime(iso)}`;
}

/** Human labels for enum values used across the UI. */
export const jobStatusLabel: Record<JobStatus, string> = {
  pending: "Pending",
  in_progress: "In Progress",
  completed: "Completed",
  cancelled: "Cancelled",
};

export const truckStatusLabel: Record<TruckStatus, string> = {
  in_use: "In Use",
  in_shop: "In Shop",
  available: "Available",
};

export const dumpsterStatusLabel: Record<DumpsterStatus, string> = {
  out: "Out",
  in_yard: "In Yard",
  in_shop: "In Shop",
};

/** Build an Apple Maps deep link for a job address (driver "navigate" button). */
export function appleMapsUrl(address: string): string {
  return `https://maps.apple.com/?q=${encodeURIComponent(address)}`;
}

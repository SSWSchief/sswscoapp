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
  // Date-only values represent a local business date, not midnight UTC.
  const d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(iso) ? `${iso}T12:00:00` : iso);
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
  en_route: "En Route",
  arrived: "Arrived",
  complete: "Complete",
  cancelled: "Cancelled",
};

export const truckStatusLabel: Record<TruckStatus, string> = {
  in_use: "In Use",
  down: "Down",
  in_shop: "In Shop",
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

export function googleMapsUrl(address: string): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`;
}

/** "just now" / "15m ago" / "3h ago" / "May 15" relative time. */
export function relativeTime(iso: string, now: number = Date.now()): string {
  const diff = now - new Date(iso).getTime();
  const sec = Math.round(diff / 1000);
  if (sec < 45) return "just now";
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  if (day < 7) return `${day}d ago`;
  return formatDate(iso);
}

/** Deterministic avatar color class from a person's initials/name. */
const avatarPalette = [
  "bg-blue-100 text-blue-700",
  "bg-emerald-100 text-emerald-700",
  "bg-amber-100 text-amber-700",
  "bg-violet-100 text-violet-700",
  "bg-rose-100 text-rose-700",
  "bg-cyan-100 text-cyan-700",
  "bg-indigo-100 text-indigo-700",
  "bg-teal-100 text-teal-700",
];

export function avatarColor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return avatarPalette[hash % avatarPalette.length];
}

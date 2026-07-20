import { cn } from "@/lib/utils";
import {
  dumpsterStatusLabel,
  jobStatusLabel,
  truckStatusLabel,
} from "@/lib/utils";
import type {
  DumpsterStatus,
  JobStatus,
  TruckStatus,
} from "@/lib/types";

/**
 * The status pill used throughout the app. Colors follow the wireframe legend
 * (section 19 "Status Badges"): blue = in progress, amber = pending,
 * green = complete/in use, gray = in shop / out of service.
 */
type Tone = "blue" | "amber" | "green" | "gray" | "slate";

const toneClasses: Record<Tone, string> = {
  blue: "bg-brand-50 text-brand-500",
  amber: "bg-amber-50 text-amber-600",
  green: "bg-green-50 text-green-600",
  gray: "bg-gray-100 text-gray-600",
  slate: "bg-slate-100 text-slate-600",
};

function Pill({ tone, label }: { tone: Tone; label: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
        toneClasses[tone]
      )}
    >
      {label}
    </span>
  );
}

const jobTone: Record<JobStatus, Tone> = {
  pending: "amber",
  in_progress: "blue",
  completed: "green",
  cancelled: "gray",
};

export function JobStatusBadge({ status }: { status: JobStatus }) {
  return <Pill tone={jobTone[status]} label={jobStatusLabel[status]} />;
}

const truckTone: Record<TruckStatus, Tone> = {
  in_use: "green",
  in_shop: "amber",
  available: "blue",
};

export function TruckStatusBadge({ status }: { status: TruckStatus }) {
  return <Pill tone={truckTone[status]} label={truckStatusLabel[status]} />;
}

const dumpsterTone: Record<DumpsterStatus, Tone> = {
  out: "green",
  in_yard: "blue",
  in_shop: "amber",
};

export function DumpsterStatusBadge({ status }: { status: DumpsterStatus }) {
  return <Pill tone={dumpsterTone[status]} label={dumpsterStatusLabel[status]} />;
}

export { Pill as Badge };

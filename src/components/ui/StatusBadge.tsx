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
import { Icon, type IconName } from "./Icon";

/**
 * Status pill. Colors follow the wireframe legend, but every badge also carries
 * a text label (and completed/in-shop states a distinguishing glyph) so meaning
 * never depends on color alone — important for colorblind users and fast
 * scanning where several states share a hue. Tones use 100/700 pairings that
 * clear WCAG AA contrast.
 */
type Tone = "blue" | "amber" | "green" | "gray" | "slate";

const toneClasses: Record<Tone, string> = {
  blue: "bg-blue-100 text-blue-700",
  amber: "bg-amber-100 text-amber-800",
  green: "bg-emerald-100 text-emerald-700",
  gray: "bg-gray-100 text-gray-600",
  slate: "bg-slate-100 text-slate-700",
};

function Pill({
  tone,
  label,
  icon,
}: {
  tone: Tone;
  label: string;
  icon?: IconName;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
        toneClasses[tone]
      )}
    >
      {icon && <Icon name={icon} width={12} height={12} className="shrink-0" />}
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
const jobIcon: Partial<Record<JobStatus, IconName>> = {
  completed: "check",
  cancelled: "close",
};

export function JobStatusBadge({ status }: { status: JobStatus }) {
  return (
    <Pill tone={jobTone[status]} label={jobStatusLabel[status]} icon={jobIcon[status]} />
  );
}

const truckTone: Record<TruckStatus, Tone> = {
  in_use: "green",
  in_shop: "amber",
  available: "blue",
};
const truckIcon: Partial<Record<TruckStatus, IconName>> = {
  in_shop: "settings",
};

export function TruckStatusBadge({ status }: { status: TruckStatus }) {
  return (
    <Pill tone={truckTone[status]} label={truckStatusLabel[status]} icon={truckIcon[status]} />
  );
}

const dumpsterTone: Record<DumpsterStatus, Tone> = {
  out: "green",
  in_yard: "blue",
  in_shop: "amber",
};
const dumpsterIcon: Partial<Record<DumpsterStatus, IconName>> = {
  in_shop: "settings",
};

export function DumpsterStatusBadge({ status }: { status: DumpsterStatus }) {
  return (
    <Pill tone={dumpsterTone[status]} label={dumpsterStatusLabel[status]} icon={dumpsterIcon[status]} />
  );
}

export { Pill as Badge };

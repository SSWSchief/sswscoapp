import { Topbar } from "@/components/dispatcher/Topbar";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { getTrucks } from "@/lib/data";

// Screen 15 — Map View (dispatcher, "future ready"). Live GPS is a Phase 2 item;
// this lays out the shell so the transition is a drop-in later.
export default function MapPage() {
  const trucks = getTrucks();
  return (
    <>
      <Topbar title="Map" />
      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        <Card className="overflow-hidden">
          <div className="flex flex-wrap items-center gap-4 px-5 py-4 border-b border-brand-ice/60">
            <div className="flex gap-4 font-heading text-sm font-medium uppercase tracking-wide">
              <button className="text-brand-blue border-b-2 border-brand-blue pb-1">
                Trucks
              </button>
              <button className="text-brand-steel pb-1">Dumpsters</button>
            </div>
            <div className="grid w-full grid-cols-2 gap-2 text-sm text-brand-steel sm:ml-auto sm:flex sm:w-auto sm:gap-4">
              {["Show Trucks", "Show Dumpsters", "Show Jobs"].map((l) => (
                <label key={l} className="flex min-h-11 items-center gap-2">
                  <input type="checkbox" defaultChecked className="h-5 w-5 accent-brand-blue" />
                  {l}
                </label>
              ))}
            </div>
          </div>

          {/* Map placeholder */}
          <div className="relative h-[55dvh] min-h-[360px] max-h-[560px] bg-brand-mist flex items-center justify-center">
            <div
              className="absolute inset-0 opacity-40"
              style={{
                backgroundImage:
                  "linear-gradient(#dfe6ee 1px, transparent 1px), linear-gradient(90deg, #dfe6ee 1px, transparent 1px)",
                backgroundSize: "40px 40px",
              }}
            />
            {/* Sample pins */}
            <Pin className="top-[30%] left-[35%]" icon="truck" tone="brand" label="T-05" />
            <Pin className="top-[45%] left-[55%]" icon="dumpster" tone="green" label="D-102" />
            <Pin className="top-[62%] left-[40%]" icon="truck" tone="brand" label="T-02" />
            <Pin className="top-[55%] left-[70%]" icon="pin" tone="slate" label="Job" />

            <div className="relative mx-4 text-center bg-white/90 backdrop-blur rounded-card border border-brand-ice px-4 py-5 shadow-card sm:px-6">
              <Icon
                name="map"
                width={28}
                height={28}
                className="mx-auto text-brand-blue mb-2"
              />
              <p className="font-heading text-sm font-medium uppercase tracking-wide text-brand-charcoal">
                Live tracking coming in Phase 2 with GPS devices
              </p>
              <p className="text-xs text-brand-steel mt-1">
                Asset positions show manual, AirTag, or GPS-placeholder sources.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-5 px-5 py-3 border-t border-brand-ice/60 text-sm text-brand-steel">
            <LegendDot color="bg-brand-blue" label="Truck" />
            <LegendDot color="bg-status-complete" label="Dumpster" />
            <LegendDot color="bg-slate-400" label="Job Location" />
          </div>
          <div className="grid gap-3 border-t border-brand-ice/60 p-5 md:grid-cols-3">
            {trucks.slice(0, 3).map((truck) => (
              <div key={truck.id} className="rounded border border-brand-ice p-3">
                <div className="font-semibold text-brand-charcoal">{truck.number}</div>
                <div className="text-sm text-brand-steel">{truck.lastKnownLocation}</div>
                <div className="text-xs text-brand-silver">
                  {truck.airTagId} · {truck.gpsSource}
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </>
  );
}

function Pin({
  className,
  icon,
  tone,
  label,
}: {
  className: string;
  icon: "truck" | "dumpster" | "pin";
  tone: "brand" | "green" | "slate";
  label: string;
}) {
  const bg = {
    brand: "bg-brand-blue",
    green: "bg-status-complete",
    slate: "bg-slate-400",
  }[tone];
  return (
    <div className={`absolute ${className} flex flex-col items-center`}>
      <div
        className={`h-9 w-9 rounded-full ${bg} text-white flex items-center justify-center shadow-md`}
      >
        <Icon name={icon} width={18} height={18} />
      </div>
      <span className="mt-1 text-[11px] font-medium text-brand-charcoal bg-white/85 px-1.5 rounded-sm">
        {label}
      </span>
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`h-2.5 w-2.5 rounded-full ${color}`} />
      {label}
    </span>
  );
}

import { Topbar } from "@/components/dispatcher/Topbar";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";

// Screen 15 — Map View (dispatcher, "future ready"). Live GPS is a Phase 2 item;
// this lays out the shell so the transition is a drop-in later.
export default function MapPage() {
  return (
    <>
      <Topbar title="Map" />
      <div className="flex-1 overflow-y-auto p-6">
        <Card className="overflow-hidden">
          <div className="flex flex-wrap items-center gap-4 px-5 py-4 border-b border-gray-100">
            <div className="flex gap-4 text-sm font-medium">
              <button className="text-brand-500 border-b-2 border-brand-500 pb-1">
                Trucks
              </button>
              <button className="text-gray-500 pb-1">Dumpsters</button>
            </div>
            <div className="flex gap-4 text-sm text-gray-600 ml-auto">
              {["Show Trucks", "Show Dumpsters", "Show Jobs"].map((l) => (
                <label key={l} className="flex items-center gap-1.5">
                  <input type="checkbox" defaultChecked className="accent-brand" />
                  {l}
                </label>
              ))}
            </div>
          </div>

          {/* Map placeholder */}
          <div className="relative h-[460px] bg-[#eef2f6] flex items-center justify-center">
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

            <div className="relative text-center bg-white/80 backdrop-blur rounded-xl px-6 py-5 shadow-card">
              <Icon
                name="map"
                width={28}
                height={28}
                className="mx-auto text-brand-500 mb-2"
              />
              <p className="text-sm font-medium text-gray-800">
                Live tracking coming in Phase 2 with GPS devices
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Asset positions shown here are based on job assignments.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-5 px-5 py-3 border-t border-gray-100 text-sm text-gray-600">
            <LegendDot color="bg-brand-500" label="Truck" />
            <LegendDot color="bg-status-complete" label="Dumpster" />
            <LegendDot color="bg-slate-400" label="Job Location" />
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
    brand: "bg-brand-500",
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
      <span className="mt-1 text-[11px] font-medium text-gray-700 bg-white/80 px-1.5 rounded">
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

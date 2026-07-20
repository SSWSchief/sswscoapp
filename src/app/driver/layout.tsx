import { BottomNav } from "@/components/driver/BottomNav";

/**
 * Driver experience is mobile-first (iPad/phone per the PRD). On larger screens
 * we present it inside a centered phone frame so it can be demoed on a laptop
 * during the client walkthrough.
 */
export default function DriverLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-surface flex items-center justify-center sm:py-8">
      <div className="w-full sm:max-w-[420px] sm:rounded-[2.25rem] sm:border-[10px] sm:border-gray-900 sm:shadow-2xl overflow-hidden bg-white">
        <div className="flex flex-col h-screen sm:h-[860px]">
          {children}
          <BottomNav />
        </div>
      </div>
    </div>
  );
}

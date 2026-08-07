"use client";
import { MobileHeader } from "@/components/driver/MobileHeader";
import { TeamMessages } from "@/components/system/TeamMessages";
export default function Page() {
  return (
    <>
      <MobileHeader title="Messages" />
      <div className="flex min-h-0 flex-1 overflow-y-auto bg-surface p-3">
        <TeamMessages />
      </div>
    </>
  );
}

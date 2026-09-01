"use client";

import { Sidebar } from "@/components/dispatcher/Sidebar";
import { useOperations } from "@/components/system/OperationsProvider";
import { effectivePermissions } from "@/lib/permissions";
import { availablePortals } from "@/lib/portal-access";

/**
 * The staff sidebar, kept alongside the driver portal on a computer.
 *
 * Owners and dispatchers who also drive open the driver portal from their own
 * sidebar, and until now the only way back was the drawer — the portal reads
 * as a dead end on a desktop. Anyone with a single portal, which is every
 * driver, gets nothing back, so the field UI on a phone is untouched.
 */
export function DriverStaffSidebar() {
  const { currentUser } = useOperations();
  if (!currentUser) return null;
  const portals = availablePortals(
    currentUser.accessRole,
    effectivePermissions(currentUser),
  );
  if (portals.length < 2) return null;
  return <Sidebar />;
}

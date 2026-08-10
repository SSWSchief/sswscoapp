import { DriverShell } from "@/components/driver/DriverShell";
import { PortalProviders } from "@/components/system/PortalProviders";

export default function DriverLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <PortalProviders>
      <DriverShell>{children}</DriverShell>
    </PortalProviders>
  );
}

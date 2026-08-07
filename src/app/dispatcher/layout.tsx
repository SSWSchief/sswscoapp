import { DispatcherShell } from "@/components/dispatcher/DispatcherShell";
import { PortalProviders } from "@/components/system/PortalProviders";

export default function DispatcherLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <PortalProviders>
      <DispatcherShell>{children}</DispatcherShell>
    </PortalProviders>
  );
}

import { DispatcherShell } from "@/components/dispatcher/DispatcherShell";

export default function ManagementLayout({ children }: { children: React.ReactNode }) {
  return <DispatcherShell>{children}</DispatcherShell>;
}

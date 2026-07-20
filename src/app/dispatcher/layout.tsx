import { DispatcherShell } from "@/components/dispatcher/DispatcherShell";

export default function DispatcherLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <DispatcherShell>{children}</DispatcherShell>;
}

import { Icon, type IconName } from "./Icon";

export function EmptyState({
  icon = "info",
  title,
  message,
  action,
}: {
  icon?: IconName;
  title: string;
  message?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center px-6 py-14">
      <div className="h-12 w-12 rounded border border-brand-ice bg-brand-mist text-brand-blue flex items-center justify-center mb-3">
        <Icon name={icon} width={24} height={24} />
      </div>
      <h3 className="font-heading text-sm font-semibold uppercase tracking-wide text-brand-charcoal">
        {title}
      </h3>
      {message && (
        <p className="text-sm text-brand-steel mt-1 max-w-xs">{message}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

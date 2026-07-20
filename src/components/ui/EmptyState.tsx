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
      <div className="h-12 w-12 rounded-full bg-gray-100 text-gray-400 flex items-center justify-center mb-3">
        <Icon name={icon} width={24} height={24} />
      </div>
      <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
      {message && (
        <p className="text-sm text-gray-500 mt-1 max-w-xs">{message}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

import Link from "next/link";
import { Icon } from "@/components/ui/Icon";

/** Top bar for driver screens. `back` renders a back chevron to the given href. */
export function MobileHeader({
  title,
  back,
  menu,
}: {
  title: string;
  back?: string;
  menu?: boolean;
}) {
  return (
    <header className="shrink-0 h-14 bg-white border-b border-gray-200 flex items-center justify-between px-4 dark:bg-gray-900 dark:border-white/10">
      <div className="w-8">
        {back ? (
          <Link
            href={back}
            className="text-gray-600 dark:text-gray-300 -ml-1 inline-flex"
            aria-label="Back"
          >
            <Icon name="chevron-right" className="rotate-180" />
          </Link>
        ) : menu ? (
          <button className="text-gray-600 dark:text-gray-300 -ml-1" aria-label="Menu">
            <Icon name="menu" />
          </button>
        ) : null}
      </div>
      <h1 className="text-base font-semibold text-gray-900 dark:text-white">
        {title}
      </h1>
      <button
        className="w-8 text-gray-500 dark:text-gray-400 flex justify-end"
        aria-label="Notifications"
      >
        <Icon name="bell" width={22} height={22} />
      </button>
    </header>
  );
}

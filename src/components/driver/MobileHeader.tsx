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
    <header className="shrink-0 h-14 bg-white border-b border-brand-ice/70 flex items-center justify-between px-4 dark:bg-gray-900 dark:border-white/10">
      <div className="w-8">
        {back ? (
          <Link
            href={back}
            className="text-brand-steel dark:text-gray-300 -ml-1 inline-flex"
            aria-label="Back"
          >
            <Icon name="chevron-right" className="rotate-180" />
          </Link>
        ) : menu ? (
          <button className="text-brand-steel dark:text-gray-300 -ml-1" aria-label="Menu">
            <Icon name="menu" />
          </button>
        ) : null}
      </div>
      <h1 className="font-heading text-base font-semibold uppercase tracking-wide text-brand-charcoal dark:text-white">
        {title}
      </h1>
      <button
        className="w-8 text-brand-steel dark:text-gray-400 flex justify-end"
        aria-label="Notifications"
      >
        <Icon name="bell" width={22} height={22} />
      </button>
    </header>
  );
}

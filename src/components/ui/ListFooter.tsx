import * as React from "react";

/**
 * The count line under a list.
 *
 * Lists load a capped slice of their table, and these lines used to report the
 * slice as the total — "Showing 50 of 50 customers" while the company had far
 * more. An owner reads that as a fact about the business, so a cap that is
 * reached has to be visible rather than merely survivable.
 */
export function ListFooter({
  shown,
  loaded,
  total,
  noun,
  note,
}: {
  /** Rows after the on-screen search and filters. */
  shown: number;
  /** Rows held in memory — what the filters actually ran against. */
  loaded: number;
  /** Rows matching the underlying query, whether or not they were loaded. */
  total: number;
  noun: string;
  note?: React.ReactNode;
}) {
  return (
    <div className="px-5 py-3 text-sm text-brand-steel border-t border-brand-ice/60">
      Showing {shown} of {loaded} {noun}
      {total > loaded ? (
        <>
          {" "}
          · <strong className="font-semibold">{total} in total</strong> —
          searching here only covers the {loaded} loaded
        </>
      ) : null}
      {note ? <> · {note}</> : null}
    </div>
  );
}

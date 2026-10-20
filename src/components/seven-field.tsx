import type { ReactNode } from "react";
import { nflSeven } from "@/core/nfl-seven";

/** One canonical slot layout. Input order, rarity and player position cannot
 * move a saved selection; FLEX remains its assigned slot. */
export function SevenField({
  slots = nflSeven.slots,
  list = false,
  label,
  children,
}: {
  slots?: { id: string }[];
  list?: boolean;
  label: string;
  children: (slot: { id: string }) => ReactNode;
}) {
  return (
    <div
      className={list ? "seven-list" : "fantasy-field seven-field"}
      aria-label={label}
    >
      {slots.map((slot) => (
        <div className="seven-slot" key={slot.id} data-slot={slot.id}>
          {children(slot)}
        </div>
      ))}
    </div>
  );
}

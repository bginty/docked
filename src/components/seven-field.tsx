"use client";
import { useState, type ReactNode } from "react";
import { nflSeven } from "@/core/nfl-seven";
import {
  sportConfigurations,
  nbaWeeklyConfiguration,
} from "@/core/sport-configuration";

/** One canonical slot layout. Input order, rarity and player position cannot
 * move a saved selection; FLEX remains its assigned slot. */
export function SevenField({
  slots = nflSeven.slots,
  list = false,
  label,
  children,
  sport = "nfl",
}: {
  slots?: { id: string }[];
  list?: boolean;
  label: string;
  children: (slot: { id: string }) => ReactNode;
  sport?: string;
}) {
  const [group, setGroup] = useState("");
  const config =
    sport === "basketball" && slots.some((s) => s.id === "UTIL1")
      ? nbaWeeklyConfiguration
      : sportConfigurations[sport];
  if (config === nbaWeeklyConfiguration)
    return (
      <section
        className={`sport-lineup sport-lineup-court nba-court ${list ? "nba-lineup-list" : "nba-lineup-field"}`}
        aria-label={label}
      >
        <div className="nba-eight-slots">
          {slots.map((slot) => (
            <div className="sport-slot" data-slot={slot.id} key={slot.id}>
              <span className="sport-slot-label">
                {config.groups.find((g) => g.slots.includes(slot.id))?.label ??
                  slot.id}
              </span>
              {children(slot)}
            </div>
          ))}
        </div>
      </section>
    );
  if (config && sport !== "nfl") {
    // A later format must never hide historical slot IDs it no longer defines.
    const known = new Set(config.groups.flatMap((g) => g.slots));
    const unmatched = slots.filter((s) => !known.has(s.id)).map((s) => s.id);
    const groups = [
      ...config.groups.filter((g) => slots.some((s) => g.slots.includes(s.id))),
      ...(unmatched.length
        ? [{ id: "saved", label: "Saved positions", slots: unmatched }]
        : []),
    ];
    const selected = groups.find((g) => g.id === group) ?? groups[0];
    return (
      <section
        className={`sport-lineup sport-lineup-${config.field}`}
        aria-label={label}
      >
        {!list && selected && (
          <div
            className="sport-field-overview"
            aria-label={`${config.label} position groups`}
          >
            {groups.map((g) => (
              <button
                type="button"
                key={g.id}
                aria-pressed={selected.id === g.id}
                onClick={() => setGroup(g.id)}
              >
                {g.label}
                <strong>{g.slots.length}</strong>
              </button>
            ))}
          </div>
        )}
        {(list ? groups : selected ? [selected] : []).map((g) => (
          <section key={g.id} aria-label={g.label}>
            <h3>
              {g.label} · {g.slots.length}
            </h3>
            <div className={list ? "sport-slot-list" : "sport-slot-grid"}>
              {slots
                .filter((s) => g.slots.includes(s.id))
                .map((s) => (
                  <div key={s.id} data-slot={s.id} className="sport-slot">
                    <span className="sport-slot-label">{s.id}</span>
                    {children(s)}
                  </div>
                ))}
            </div>
          </section>
        ))}
      </section>
    );
  }
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

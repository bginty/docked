"use client";
import { type ReactNode } from "react";
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
    if (sport === "afl")
      groups.sort(
        (a, b) =>
          ["BACK", "MID", "RUCK", "FWD"].indexOf(a.id) -
          ["BACK", "MID", "RUCK", "FWD"].indexOf(b.id),
      );
    return (
      <section
        className={`sport-lineup sport-lineup-${config.field} compact-sport-field ${list ? "compact-sport-list" : "compact-sport-formation"}`}
        data-sport={sport}
        aria-label={label}
      >
        {!list && (
          <svg
            className="formation-markings"
            viewBox="0 0 600 1400"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            {sport === "afl" ? (
              <>
                <ellipse cx="300" cy="700" rx="292" ry="690" />
                <ellipse cx="300" cy="700" rx="55" ry="60" />
                <path d="M8 700H592M260 12V70H340V12M260 1388V1330H340V1388M54 320Q300 500 546 320M54 1080Q300 900 546 1080" />
              </>
            ) : (
              <>
                <rect x="8" y="12" width="584" height="1376" />
                <path d="M8 75H592M8 260H592M8 470H592M8 700H592M8 930H592M8 1140H592M8 1325H592M150 12V1388M450 12V1388" />
              </>
            )}
          </svg>
        )}
        {groups.map((g) => (
          <section key={g.id} aria-label={g.label} data-group={g.id}>
            <h3>
              {g.label} · {g.slots.length}
            </h3>
            <div
              className={list ? "sport-slot-list" : "sport-slot-grid"}
              style={
                !list
                  ? {
                      gridTemplateColumns: `repeat(${g.slots.length === 8 ? 4 : g.slots.length === 6 || g.slots.length === 3 ? 3 : Math.min(2, g.slots.length)}, minmax(0, 1fr))`,
                    }
                  : undefined
              }
            >
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

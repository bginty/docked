"use client";
import { useState } from "react";
import type { FantasyCompetition } from "@/core/fantasy";
import { FantasySheet } from "./fantasy-sheet";
export function CompetitionWeekSelector({
  rounds,
  selected,
  onSelect,
}: {
  rounds: FantasyCompetition[];
  selected: string;
  onSelect: (id: string) => void;
}) {
  const [open, setOpen] = useState(false),
    index = rounds.findIndex((c) => c.id === selected),
    current = rounds[index];
  return (
    <nav className="competition-weeks" aria-label="Competition weeks">
      <button
        className="play-support"
        aria-label="Previous week"
        disabled={index <= 0}
        onClick={() => onSelect(rounds[index - 1].id)}
      >
        ‹
      </button>
      <button
        className="play-support"
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
      >
        {current?.season} · Week {current?.round} <span aria-hidden>⌄</span>
      </button>
      <button
        className="play-support"
        aria-label="Next week"
        disabled={index < 0 || index >= rounds.length - 1}
        onClick={() => onSelect(rounds[index + 1].id)}
      >
        ›
      </button>
      {open && (
        <FantasySheet
          title="Choose competition week"
          historyEntry
          onClose={() => setOpen(false)}
        >
          <div className="competition-week-options">
            {rounds.map((c) => (
              <button
                className="play-support"
                key={c.id}
                aria-current={c.id === selected ? "true" : undefined}
                onClick={() => {
                  setOpen(false);
                  onSelect(c.id);
                }}
              >
                {c.season} · Week {c.round}
                <small>
                  {c.scored_at
                    ? "Completed"
                    : Date.parse(c.locks_at) <= Date.now()
                      ? "Entries closed"
                      : "Open for planning"}
                </small>
              </button>
            ))}
          </div>
          <p>
            Only published competition weeks are available. Earlier teams are
            shown from saved entries, never your current collection.
          </p>
        </FantasySheet>
      )}
    </nav>
  );
}

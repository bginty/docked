"use client";
import {
  competitionName,
  competitionSubtitle,
} from "@/core/competition-display";
export function CompetitionSwitch({
  mode,
  onChange,
  className = "standings-segments",
}: {
  mode: string;
  onChange: (mode: "SALARY_CAP" | "OPEN") => void;
  className?: string;
}) {
  return (
    <nav className={className} aria-label="Competition">
      {(["SALARY_CAP", "OPEN"] as const).map((m) => (
        <button
          type="button"
          key={m}
          aria-pressed={mode === m}
          onClick={() => onChange(m)}
        >
          {competitionName(m)}
          <small>{competitionSubtitle(m)}</small>
        </button>
      ))}
    </nav>
  );
}

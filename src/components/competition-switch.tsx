"use client";
import {
  competitionName,
  competitionSubtitle,
} from "@/core/competition-display";
export function CompetitionSwitch({
  mode,
  onChange,
  className = "standings-segments",
  salaryLabel,
  disabled = false,
}: {
  mode: string;
  onChange: (mode: "SALARY_CAP" | "OPEN") => void;
  className?: string;
  salaryLabel?: string;
  disabled?: boolean;
}) {
  return (
    <nav className={className} aria-label="Competition">
      {(["SALARY_CAP", "OPEN"] as const).map((m) => (
        <button
          type="button"
          key={m}
          aria-pressed={mode === m}
          disabled={disabled}
          onClick={() => onChange(m)}
        >
          {competitionName(m)}
          <small>
            {m === "SALARY_CAP" && salaryLabel !== undefined
              ? salaryLabel
              : competitionSubtitle(m)}
          </small>
        </button>
      ))}
    </nav>
  );
}

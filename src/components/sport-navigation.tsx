"use client";
import { useSport } from "./sport-context";
import { isHiddenWorkspaceSport } from "@/core/workspace-sport";

const sports = [
  ["nfl", "NFL"],
  ["basketball", "NBA"],
  ["afl", "AFL"],
  ["nrl", "NRL"],
] as const;

/** One workspace preference; authorization remains on every sport API. */
export function SportNavigation() {
  const { sport, change, beta, notice, ready, capabilitiesReady } = useSport();
  return (
    <div className="workspace-sport-navigation">
      <nav className="owned-sports" aria-label="Sport">
        {sports
          .filter(([key]) => !isHiddenWorkspaceSport(key))
          .map(([key, label]) => (
            <button
              type="button"
              key={key}
              disabled={
                !ready ||
                !capabilitiesReady ||
                (key !== "nfl" && !beta.includes(key))
              }
              aria-pressed={sport === key}
              onClick={() => change(key)}
            >
              {label}
            </button>
          ))}
      </nav>
      {notice && (
        <p role="status" className="form-help">
          {notice}
        </p>
      )}
    </div>
  );
}

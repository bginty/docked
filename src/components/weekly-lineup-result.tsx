"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { boundedFetch } from "@/core/bounded-request";
import type { StandingRow } from "@/core/standings";
export function WeeklyLineupResult({ competition }: { competition: string }) {
  const [data, setData] = useState<{
      competition: string;
      finalised: boolean;
      entry: StandingRow | null;
    } | null>(null),
    [error, setError] = useState("");
  const generation = useRef(0);
  const read = useCallback(async () => {
    const token = ++generation.current;
    try {
      const response = await boundedFetch(
        `/api/fantasy/lineup-history?competition=${encodeURIComponent(competition)}`,
        { cache: "no-store" },
      );
      const body = await response.json();
      if (!response.ok) throw Error(body.error || "Results unavailable.");
      if (body.competition !== competition)
        throw Error("Competition changed. Please retry.");
      if (token === generation.current) {
        setData(body);
        setError("");
      }
    } catch (e) {
      if (token === generation.current)
        setError(e instanceof Error ? e.message : "Results unavailable.");
    }
  }, [competition]);
  useEffect(() => {
    void read();
    const refresh = () => {
      if (!document.hidden) void read();
    };
    const timer = setInterval(refresh, 30000);
    window.addEventListener("focus", refresh);
    window.addEventListener("docked-app-resume", refresh);
    return () => {
      generation.current++;
      clearInterval(timer);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("docked-app-resume", refresh);
    };
  }, [read]);
  const current = data?.competition === competition ? data : null;
  return (
    <div className="weekly-lineup-result" aria-busy={!current && !error}>
      {error && (
        <p role="alert">
          {error}{" "}
          <button className="play-support" onClick={() => void read()}>
            Retry results
          </button>
        </p>
      )}
      {!current && !error && (
        <p role="status">Loading your recorded results…</p>
      )}
      {current &&
        (!current.entry ? (
          <p>No published result is recorded for this entry yet.</p>
        ) : (
          <>
            <p>
              Team total:{" "}
              <strong>
                {current.entry.centipoints === null
                  ? "Awaiting player statistics"
                  : (current.entry.centipoints / 100).toLocaleString("en-AU", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
              </strong>{" "}
              · Rank {current.entry.rank ?? "pending"} ·{" "}
              {current.finalised &&
              current.entry.centipoints !== null &&
              current.entry.status === "final"
                ? "Final"
                : "Provisional"}
            </p>
            <ul className="historical-lineup-scores">
              {current.entry.lineup?.map((p) => (
                <li key={p.slot}>
                  {p.slot} · {p.name}:{" "}
                  {p.centipoints === null
                    ? "Awaiting player statistics"
                    : (p.centipoints / 100).toFixed(2)}
                </li>
              ))}
            </ul>
          </>
        ))}
    </div>
  );
}

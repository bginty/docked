"use client";
import { lazy, Suspense, useEffect, useState } from "react";
import { boundedFetch } from "@/core/bounded-request";
import type { MemberTestView } from "@/core/member-test-wallet";
import type { CollectionQuery } from "@/core/owned-collection";
import { MemberTestWallet } from "./member-test-wallet";
import { WeeklyCorePanel } from "./weekly-core-panel";
import { LightSweep } from "./startup-loading";
const EarlierPacks = lazy(() =>
  import("./collection-legacy-packs").then((m) => ({
    default: m.CollectionLegacyPacks,
  })),
);
export function CollectionPacks({
  member,
  sport,
}: {
  member: string;
  sport: CollectionQuery["sport"];
}) {
  const [state, setState] = useState<MemberTestView | null>(null),
    [error, setError] = useState(""),
    [attempt, setAttempt] = useState(0);
  const [weekly, setWeekly] = useState(false),
    [earlier, setEarlier] = useState(false);
  useEffect(() => {
    const c = new AbortController();
    setError("");
    void boundedFetch("/api/test-wallet?view=packs", {
      cache: "no-store",
      signal: c.signal,
    })
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw Error(d.error || "Packs unavailable");
        if (d.state?.member !== member)
          throw Error("Your account changed. Sign in again.");
        if (!c.signal.aborted) setState(d.state);
      })
      .catch((e) => {
        if (!c.signal.aborted) setError(e.message);
      });
    return () => c.abort();
  }, [member, attempt]);
  return (
    <div className="owned-packs">
      {error && (
        <div role="alert">
          <p>{error}</p>
          <button onClick={() => setAttempt((n) => n + 1)}>Retry</button>
        </div>
      )}
      {!state && !error && <LightSweep compact label="Loading your packs…" />}
      {state && (
        <MemberTestWallet initial={state} surface="packs" sport={sport} />
      )}
      {sport === "nfl" && (
        <>
          <details
            className="owned-disclosure"
            onToggle={(e) => setWeekly(e.currentTarget.open)}
          >
            <summary>Weekly starter packs & history</summary>
            {weekly && <WeeklyCorePanel member={member} history />}
          </details>
          <details
            className="owned-disclosure"
            onToggle={(e) => setEarlier(e.currentTarget.open)}
          >
            <summary>Original starter & earlier reward packs</summary>
            {earlier && (
              <Suspense fallback={<p role="status">Loading saved packs…</p>}>
                <EarlierPacks member={member} />
              </Suspense>
            )}
          </details>
        </>
      )}
    </div>
  );
}

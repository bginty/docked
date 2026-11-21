"use client";
import Link from "next/link";
import { packShopHref } from "@/core/pack-presentation";
import { useEffect, useState } from "react";
import { boundedFetch } from "@/core/bounded-request";
import type { PublicSport } from "@/core/public-customer";
import type { SandboxState } from "@/core/sport-sandbox";
import { sportStandingRounds } from "@/core/sport-standings";
import { SportSandbox } from "./sport-sandbox";
import { CompetitionResults } from "./competition-results";
import { PrizesPage } from "./prizes-page";

function CompetitionWorkspace({
  sport,
  surface,
}: {
  sport: PublicSport;
  surface: "play" | "results" | "prizes";
}) {
  const [state, setState] = useState<SandboxState | null>(null);
  const [error, setError] = useState(false),
    [attempt, setAttempt] = useState(0);
  const apiPath = `/api/public-gameplay?sport=${sport}`;
  useEffect(() => {
    const controller = new AbortController();
    let disposed = false;
    setState(null);
    setError(false);
    void boundedFetch(apiPath, { cache: "no-store", signal: controller.signal })
      .then(async (r) => {
        if (!r.ok) throw Error("Unavailable");
        const next = (await r.json()).state as SandboxState;
        if (next?.sport !== sport) throw Error("Sport mismatch");
        if (!disposed) setState(next);
      })
      .catch(() => {
        if (!disposed) setError(true);
      });
    return () => {
      disposed = true;
      controller.abort();
    };
  }, [apiPath, sport, attempt]);
  if (error)
    return (
      <section className="fantasy-panel">
        <h1>{sport.toUpperCase()} Play</h1>
        <p role="alert">
          Your competitions could not load. Check your account eligibility and
          try again.
        </p>
        <button onClick={() => setAttempt((n) => n + 1)}>Retry</button>
      </section>
    );
  if (!state)
    return <p role="status">Loading {sport.toUpperCase()} competitionsâ€¦</p>;
  if (surface === "results")
    return (
      <CompetitionResults
        sport={sport}
        refreshEndpoint={`${apiPath}&view=standings`}
        seasonAggregationEnabled={false}
        rounds={[]}
        standings={[]}
        records={[]}
        weekly={sportStandingRounds(state)}
      />
    );
  if (surface === "prizes")
    return (
      <PrizesPage
        showUpcoming={false}
        competitions={state.competitions.map((c) => ({
          id: c.id,
          name: c.name,
          sport: c.sport,
          mode: c.rules.mode,
          season: c.season,
          week: c.round,
          salaryLabel: `$${state.configurations[c.rules.lineup_version].salaryCap / 1_000_000}m salary cap`,
        }))}
        schedules={[]}
      />
    );
  return (
    <SportSandbox
      initial={state}
      privateBeta
      publicCustomer
      apiPath={apiPath}
    />
  );
}

export function PublicGameplay(
  props: Parameters<typeof CompetitionWorkspace>[0],
) {
  return (
    <>
      {props.surface === "play" && (
        <section className="fantasy-panel">
          <h1>{props.sport.toUpperCase()} clubhouse</h1>
          <p>
            Browse your collection and build lineups where Practice entries are
            available. Scored competitions and prizes are closed.
          </p>
          <nav className="actions" aria-label="Your cards and packs">
            <Link
              className="pack-control primary"
              href={packShopHref(props.sport)}
            >
              Browse packs
            </Link>
            <Link
              className="pack-control secondary"
              href={packShopHref(props.sport, "mine")}
            >
              My packs
            </Link>
            <Link
              className="pack-control secondary"
              href={"/fantasy/cards?sport=" + props.sport}
            >
              My Cards
            </Link>
            <Link
              className="pack-control secondary"
              href="/fantasy/test-wallet"
            >
              Docked Credits
            </Link>
          </nav>
        </section>
      )}
      <CompetitionWorkspace {...props} />
    </>
  );
}

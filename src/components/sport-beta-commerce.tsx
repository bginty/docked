"use client";
import { useEffect, useState } from "react";
import { boundedFetch } from "@/core/bounded-request";
import type { MemberTestView } from "@/core/member-test-wallet";
import { fixtureSports, type FixtureSport } from "@/core/fixture-sports";
import { MemberTestWallet } from "./member-test-wallet";
import { Marketplace } from "./credit-marketplace";
import { PrivateOffersInbox } from "./private-card-offers";

export function SportBetaCommerce({
  sport,
  surface,
}: {
  sport: FixtureSport;
  surface: "packs" | "market";
}) {
  const [state, setState] = useState<MemberTestView | null>(null),
    [error, setError] = useState(""),
    [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let disposed = false;
    setState(null);
    setError("");
    void boundedFetch("/api/test-wallet", { cache: "no-store" })
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw Error(d.error || "Test economy unavailable");
        if (!disposed) setState(d.state);
      })
      .catch((e) => {
        if (!disposed)
          setError(e instanceof Error ? e.message : "Test economy unavailable");
      });
    return () => {
      disposed = true;
    };
  }, [sport, attempt]);
  const label = fixtureSports[sport].label;
  if (error)
    return (
      <section className="fantasy-panel">
        <h1>
          {label} test {surface}
        </h1>
        <p role="alert">{error}</p>
        <button onClick={() => setAttempt((n) => n + 1)}>Retry</button>
      </section>
    );
  if (!state)
    return (
      <p role="status">
        Loading {label} test {surface}…
      </p>
    );
  if (!state.products.some((p) => p.sport === sport))
    return (
      <section className="fantasy-panel">
        <h1>
          {label} test {surface}
        </h1>
        <p>This sport’s test economy is not enabled for your account.</p>
        <a href={`/fantasy/play?sport=${sport}`}>Back to Play</a>
      </section>
    );
  return (
    <>
      <p className="sport-sandbox-notice">
        Isolated {label} testing · Fictional players and test inventory. Credits
        have no cash value. No permanent collectibles are issued.
      </p>
      {surface === "packs" ? (
        <MemberTestWallet initial={state} surface="packs" sport={sport} />
      ) : (
        <>
          <Marketplace member={state.member} />
          <details>
            <summary>Offers and swaps</summary>
            <PrivateOffersInbox member={state.member} />
          </details>
        </>
      )}
    </>
  );
}

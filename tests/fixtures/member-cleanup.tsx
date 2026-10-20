import { createRoot } from "react-dom/client";
import { useEffect, useState } from "react";
import { TestWalletOverview } from "../../src/components/test-wallet-overview";
import { CompactCollectible } from "../../src/components/compact-collectible";
import { FantasyCardArtwork } from "../../src/components/fantasy-card-artwork";
import { PackArtwork } from "../../src/components/pack-artwork";
import { StarterPackHistory } from "../../src/components/starter-pack-history";
import { MemberTestView } from "../../src/core/member-test-wallet";
import { AwardedCard } from "../../src/core/pack-opening";
import { rarities, rarityLabel } from "../../src/core/card-rarity";
import { AppShell } from "../../src/components/app-shell";
import { SportProvider } from "../../src/components/sport-context";
import { EnvironmentProvider } from "../../src/components/environment-context";
Object.assign(window, { demoPath: "/fantasy/test-wallet" });
function Fixture() {
  const [state, setState] = useState<MemberTestView | null>(null);
  useEffect(() => {
    void fetch("/fixture-state")
      .then((r) => r.json())
      .then(setState);
  }, []);
  if (!state) return <p>Loading isolated test data</p>;
  const before = new URLSearchParams(location.search).has("before");
  const view = new URLSearchParams(location.search).get("view");
  return (
    <main className="test-wallet">
      <h1 className="qa-only">Isolated layout verification</h1>
      {view === "wallet" ? (
        <TestWalletOverview state={state} />
      ) : view === "starter" ? (
        <StarterPackHistory member={state.member} />
      ) : view === "packs" ? (
        <div className="pack-library">
          <h1>Pack history</h1>
          {[
            "Premium 9 Pack",
            "Standard 3 Pack",
            "Weekly starter pack",
            "Legacy eight-card pack",
          ].map((name, i) => (
            <article className="pack-history-row" key={name}>
              <PackArtwork
                name={name}
                premium={i === 0}
                core={i === 2}
                compact
              />
              <div>
                <h3>{name}</h3>
                <p>Purchased pack · Original recorded terms</p>
                <p>20 Oct 2026 · Opened</p>
              </div>
              <button className="pack-control secondary">Replay pack</button>
            </article>
          ))}
        </div>
      ) : (
        <>
          <h1>Market activity</h1>
          <div className="market-activity">
            {rarities.map((tier, i) => {
              const card: AwardedCard = {
                ...state.cards[0],
                tier,
                name:
                  i === 0
                    ? "A very long collectible player name"
                    : "Austin Ekeler",
                team: "LAC",
                position: "RB",
                serial: tier === "CORE" ? undefined : 1,
                max_supply: tier === "CORE" ? undefined : 400,
              };
              return (
                <article key={tier}>
                  <div className="market-thumbnail">
                    {before ? (
                      <FantasyCardArtwork card={card} faceOnly />
                    ) : (
                      <CompactCollectible card={card} />
                    )}
                  </div>
                  <div className="market-activity-name">
                    <h3>{card.name}</h3>
                    <p>{rarityLabel(tier)}</p>
                    <time>20 Oct</time>
                  </div>
                  <div className="market-activity-amount">
                    <span className="market-badge">
                      {i % 2 ? "Bought" : "Sold"}
                    </span>
                    <strong>10,000 credits</strong>
                    <span>{i % 2 ? "Paid" : "Sale price"}</span>
                    {!(i % 2) && <small>Fee 500 · Received 9,500</small>}
                  </div>
                </article>
              );
            })}
          </div>
        </>
      )}
    </main>
  );
}
createRoot(document.getElementById("fixture-root")!).render(
  <EnvironmentProvider
    value={{
      production: true,
      liveBeta: true,
      registrationAvailable: false,
      emailAvailable: false,
      invitationAllowed: false,
      policyVersions: null,
      accountConfigured: true,
      reason: "",
    }}
  >
    <SportProvider>
      <AppShell authenticated>
        <Fixture />
      </AppShell>
    </SportProvider>
  </EnvironmentProvider>,
);

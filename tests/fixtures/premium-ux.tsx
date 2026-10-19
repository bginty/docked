// Local-only: explicit fixture transport, never imported by application routes.
import { createRoot } from "react-dom/client";
import { useEffect, useState } from "react";
import { NflSevenPlay } from "../../src/components/nfl-seven-play";
import { ContentLoading } from "../../src/components/content-loading";
import { PurchaseCelebration } from "../../src/components/purchase-celebration";
import PackOpening from "../../src/components/pack-opening";
import { SportProvider } from "../../src/components/sport-context";
import { AppShell } from "../../src/components/app-shell";
import type { FantasyState } from "../../src/core/fantasy";
import type { NflMode } from "../../src/core/nfl-seven";
function Fixture() {
  const [data, setData] = useState<FantasyState | null>(null),
    [mode, setMode] = useState<NflMode>("SALARY_CAP"),
    [open, setOpen] = useState(false);
  const view = new URLSearchParams(location.search).get("view");
  useEffect(() => {
    void fetch("/fixture-state")
      .then((r) => r.json())
      .then(setData);
  }, []);
  if (!data) return null;
  const tier = new URLSearchParams(location.search).get("tier") ?? "CORE";
  const card = data.cards.find((c) => c.tier === tier) ?? data.cards[0];
  return (
    <SportProvider>
      <AppShell authenticated>
        {view === "loader" ? (
          <ContentLoading />
        ) : view === "reveal" ? (
          <>
            <button onClick={() => setOpen(true)}>Open isolated reveal</button>
            {open && (
              <PackOpening
                userId={data.user_id}
                name="Isolated reveal"
                receipt={{
                  id: "qa-reveal",
                  name: "Isolated reveal",
                  opened_at: new Date().toISOString(),
                  cards: [
                    card,
                    ...data.cards.filter((c) => c.id !== card.id).slice(0, 3),
                  ],
                }}
                replay
                autoOpen
                openPack={async () => {
                  throw Error("Replay must not issue cards");
                }}
                ownedIds={data.cards.map((c) => c.id)}
                onViewCard={() => {}}
                onClose={() => setOpen(false)}
              />
            )}
          </>
        ) : view === "celebration" ? (
          <>
            <button onClick={() => setOpen(true)}>
              Show isolated celebration
            </button>
            {open && (
              <PurchaseCelebration
                member={data.user_id}
                receipt={{
                  reference: "qa-sale",
                  listing: "qa",
                  price: 1000,
                  card,
                }}
                onClose={() => setOpen(false)}
              />
            )}
          </>
        ) : (
          <>
            <h1>Your lineup</h1>
            <div>
              <button onClick={() => setMode("SALARY_CAP")}>Traditional</button>
              <button onClick={() => setMode("OPEN")}>All-Star</button>
            </div>
            <NflSevenPlay
              data={data}
              mode={mode}
              busy={false}
              act={async (action, payload) => {
                const response = await fetch("/fixture-command", {
                  method: "POST",
                  body: JSON.stringify({ action, payload }),
                });
                const next = await response.json();
                setData(next.state);
                return next.result;
              }}
            />
          </>
        )}
      </AppShell>
    </SportProvider>
  );
}
createRoot(document.getElementById("fixture-root")!).render(<Fixture />);

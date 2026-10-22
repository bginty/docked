// Isolated browser component harness. Identity and HTTP persistence are simulated.
import { createRoot } from "react-dom/client";
import { useState } from "react";
import { Marketplace } from "../../src/components/marketplace";
import {
  CollectibleViewer,
  type ViewerCard,
} from "../../src/components/collectible-viewer";
import { SportProvider } from "../../src/components/sport-context";
import { PrivateOffersInbox } from "../../src/components/private-card-offers";
function Fixture({ member, cards }: { member: string; cards: ViewerCard[] }) {
  const [card, setCard] = useState<ViewerCard | null>(null);
  return (
    <SportProvider>
      <div className="app-content">
        <header className="app-topbar">
          <img
            src="/brand/docked/logos/docked-logo-horizontal.webp"
            alt="Docked"
            width="120"
          />
          <span>Isolated component test · simulated accounts</span>
        </header>
        {location.pathname.includes("cards") ? (
          <main>
            <h1>Collection fixture</h1>
            {cards.map((c) => (
              <button className="button" key={c.id} onClick={() => setCard(c)}>
                View {c.name}
              </button>
            ))}
          </main>
        ) : (
          <>
            <Marketplace member={member} />
            {cards.some((c) =>
              ["basketball", "afl", "nrl"].includes(c.sport),
            ) && (
              <details>
                <summary>Offers and swaps</summary>
                <PrivateOffersInbox member={member} sport={cards[0]?.sport} />
              </details>
            )}
          </>
        )}
        {card && (
          <CollectibleViewer card={card} onClose={() => setCard(null)} />
        )}
      </div>
    </SportProvider>
  );
}
fetch("/local-identity")
  .then((r) => r.json())
  .then((data) =>
    createRoot(document.getElementById("fixture-root")!).render(
      <Fixture {...data} />,
    ),
  );

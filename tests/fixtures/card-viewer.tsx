import { createRoot } from "react-dom/client";
import { useState } from "react";
import { CollectibleViewer } from "../../src/components/collectible-viewer";
import { FantasyCardArtwork } from "../../src/components/fantasy-card-artwork";
import { futuristicCard } from "./futuristic-data";
const tier = new URLSearchParams(location.search).get("tier") ?? "ULTRA_RARE";
const card = { ...futuristicCard, tier };
function Fixture() {
  const [open, setOpen] = useState(false);
  return (
    <main style={{ padding: 24 }}>
      <h1>Local card viewer acceptance</h1>
      <p>Synthetic scores · no hosted transactions</p>
      <button onClick={() => setOpen(true)}>Open card</button>
      <div id="unchanged-front" style={{ width: 320 }}>
        <FantasyCardArtwork card={card} faceOnly variant="detailed" />
      </div>
      {open && <CollectibleViewer card={card} onClose={() => setOpen(false)} />}
      <div style={{ height: 1500 }}>Scrollable page</div>
    </main>
  );
}
createRoot(document.getElementById("fixture-root")!).render(<Fixture />);

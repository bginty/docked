import { createRoot } from "react-dom/client";
import { useCallback, useEffect, useState } from "react";
import PackOpening from "../../src/components/pack-opening";
import { CollectibleViewer } from "../../src/components/collectible-viewer";
import type { AwardedCard, PackReceipt } from "../../src/core/pack-opening";
function Fixture() {
  const [receipt, setReceipt] = useState<PackReceipt | null>(null),
    [open, setOpen] = useState(false),
    [ready, setReady] = useState(false);
  const [selected, setSelected] = useState<AwardedCard | null>(null);
  useEffect(() => {
    void fetch("/receipt")
      .then((r) => r.json())
      .then((r) => {
        setReceipt(r);
        setReady(true);
      });
  }, []);
  const close = useCallback(() => setOpen(false), []);
  return (
    <>
      <h1>Isolated pack acceptance</h1>
      <button disabled={!ready} onClick={() => setOpen(true)}>
        Open viewer
      </button>
      {selected && (
        <CollectibleViewer card={selected} onClose={() => setSelected(null)} />
      )}
      {open && (
        <PackOpening
          preview={new URLSearchParams(location.search).get("cinema") !== "v3"}
          legacyRevealPreview={
            new URLSearchParams(location.search).get("cinema") !== "v3"
          }
          userId="isolated-test"
          name={receipt?.name ?? "Docked pack"}
          sport={receipt?.cards[0]?.sport}
          cardCount={receipt?.cards.length}
          receipt={receipt}
          onClose={close}
          ownedIds={receipt?.cards.map((c) => c.id) ?? []}
          onViewCard={(card) => {
            setOpen(false);
            setSelected(card);
          }}
          openPack={async () => {
            const r = await fetch("/open-pack", { method: "POST" });
            if (!r.ok) throw Error("offline");
            const result = await r.json();
            setReceipt(result);
            return result;
          }}
        />
      )}
    </>
  );
}
createRoot(document.getElementById("fixture-root")!).render(<Fixture />);

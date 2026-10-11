import { createRoot } from "react-dom/client";
import { useCallback, useEffect, useState } from "react";
import PackOpening from "../../src/components/pack-opening";
import type { PackReceipt } from "../../src/core/pack-opening";
function Fixture() {
  const [receipt, setReceipt] = useState<PackReceipt | null>(null),
    [open, setOpen] = useState(false),
    [ready, setReady] = useState(false);
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
      {open && (
        <PackOpening
          userId="isolated-test"
          name="NFL starter pack"
          receipt={receipt}
          onClose={close}
          ownedIds={receipt?.cards.map((c) => c.id) ?? []}
          onViewCard={() => {}}
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

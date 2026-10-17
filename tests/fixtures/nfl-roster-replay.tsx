import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import PackOpening from "../../src/components/pack-opening";
import type { PackReceipt } from "../../src/core/pack-opening";
function App() {
  const [receipt, setReceipt] = useState<PackReceipt | null>(null),
    [open, setOpen] = useState(true);
  useEffect(() => {
    void fetch("/receipt.json")
      .then((r) => r.json())
      .then(setReceipt);
  }, []);
  return (
    <main className="fantasy-mode" style={{ minHeight: "100vh", padding: 24 }}>
      <h1 style={{ fontSize: 24 }}>Local roster cleanup review</h1>
      <p>Saved test result. No new cards or credits.</p>
      <button onClick={() => setOpen(true)}>Replay saved pack</button>
      {receipt && open && (
        <PackOpening
          userId="local-review"
          name={receipt.name}
          receipt={receipt}
          openPack={async () => receipt}
          replay
          ownedIds={receipt.cards.map((c) => c.id)}
          onClose={() => setOpen(false)}
          onViewCard={() => {}}
        />
      )}
    </main>
  );
}
createRoot(document.getElementById("fixture-root")!).render(<App />);

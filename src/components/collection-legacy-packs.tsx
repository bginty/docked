"use client";
import { useEffect, useRef, useState } from "react";
import type { FantasyState, FantasyCard } from "@/core/fantasy";
import type { PackReceipt } from "@/core/pack-opening";
import { boundedFetch } from "@/core/bounded-request";
import PackOpening from "./pack-opening";
import { CollectibleViewer } from "./collectible-viewer";
/** On-demand access to existing starter/reward receipts, using the existing commands. */
export function CollectionLegacyPacks({ member }: { member: string }) {
  const [card, setCard] = useState<PackReceipt["cards"][number] | null>(null);
  const [state, setState] = useState<FantasyState | null>(null),
    [error, setError] = useState(""),
    [retry, setRetry] = useState(0);
  const [selected, setSelected] = useState<{
    id?: string;
    name: string;
    receipt: PackReceipt | null;
  } | null>(null);
  const pending = useRef<{ id: string; request: string } | null>(null),
    flight = useRef(false);
  useEffect(() => {
    const c = new AbortController();
    setError("");
    void boundedFetch("/api/fantasy", { cache: "no-store", signal: c.signal })
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok || data.state?.user_id !== member)
          throw Error(data.error || "Pack history unavailable");
        if (!c.signal.aborted) setState(data.state);
      })
      .catch((e) => {
        if (!c.signal.aborted) setError(e.message);
      });
    return () => c.abort();
  }, [member, retry]);
  const receipt = (s: FantasyState, id?: string): PackReceipt | null => {
    if (!id) return s.starter_receipt ?? null;
    const p = s.packs.find((p) => p.id === id);
    if (!p?.opened_at) return null;
    const cards = p.cards?.map((id) => s.cards.find((c) => c.id === id));
    if (!cards?.length || cards.some((c) => !c))
      throw Error(
        "Some original cards are no longer in your collection. The saved pack remains unchanged.",
      );
    return {
      id: p.id,
      name: p.name,
      opened_at: p.opened_at,
      cards: cards as FantasyCard[],
    };
  };
  const choose = (id?: string) => {
    if (!state) return;
    try {
      setSelected({
        id,
        name: id
          ? state.packs.find((p) => p.id === id)!.name
          : "NFL starter pack",
        receipt: receipt(state, id),
      });
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  };
  return (
    <>
      {error && (
        <p role="alert">
          {error} <button onClick={() => setRetry((n) => n + 1)}>Retry</button>
        </p>
      )}
      {!state && !error && <p role="status">Loading saved packs…</p>}
      {state && (
        <>
          {(state.rewards?.starter_entitled || state.starter_receipt) && (
            <button onClick={() => choose()}>
              {state.starter_receipt
                ? "View original starter pack"
                : "Open original starter pack"}
            </button>
          )}
          {state.packs.map((p) => (
            <div className="fantasy-row" key={p.id}>
              <span>
                {p.name}
                <small>
                  {p.opened_at
                    ? new Date(p.opened_at).toLocaleDateString()
                    : "Ready to open"}
                </small>
              </span>
              <button onClick={() => choose(p.id)}>
                {p.opened_at ? "View pack" : "Open pack"}
              </button>
            </div>
          ))}
          {!state.packs.length &&
            !state.starter_receipt &&
            !state.rewards?.starter_entitled && <p>No earlier packs.</p>}
        </>
      )}
      {selected && (
        <PackOpening
          ownedIds={state?.cards.map((c) => c.id) ?? []}
          onViewCard={setCard}
          userId={member}
          name={selected.name}
          receipt={selected.receipt}
          onClose={() => setSelected(null)}
          openPack={async () => {
            if (flight.current) throw Error("Opening is already in progress");
            const id = selected.id ?? "starter";
            if (pending.current && pending.current.id !== id)
              throw Error("Retry the previous pack opening first.");
            pending.current ??= { id, request: crypto.randomUUID() };
            flight.current = true;
            try {
              const r = await boundedFetch("/api/fantasy", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  action: selected.id ? "open_pack" : "open_nfl_starter",
                  payload: selected.id ? { pack_id: selected.id } : {},
                  request_id: pending.current.request,
                }),
              });
              const data = await r.json();
              if (!r.ok || data.state?.user_id !== member)
                throw Error(
                  data.error || "Opening not confirmed. Retry safely.",
                );
              const saved = receipt(data.state, selected.id);
              if (!saved)
                throw Error("Saved receipt unavailable. Retry safely.");
              pending.current = null;
              setState(data.state);
              window.dispatchEvent(new Event("docked-app-resume"));
              return saved;
            } finally {
              flight.current = false;
            }
          }}
        />
      )}
      {card && <CollectibleViewer card={card} onClose={() => setCard(null)} />}
    </>
  );
}

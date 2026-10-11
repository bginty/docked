"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { MemberTestView } from "@/core/member-test-wallet";
import type { PackReceipt } from "@/core/pack-opening";
import PackOpening from "./pack-opening";
import { FantasyCardArtwork } from "./fantasy-card-artwork";
export function MemberTestWallet({ initial }: { initial: MemberTestView }) {
  const [s, setS] = useState(initial),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [pack, setPack] = useState<string | null>(null),
    [details, setDetails] = useState<string | null>(null);
  const pending = useRef<{ key: string; id: string } | null>(null);
  const [recovery, setRecovery] = useState(false);
  const storageKey = `docked:test-wallet:pending:${initial.member}`;
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const p = JSON.parse(raw);
        if (typeof p.key === "string" && typeof p.id === "string") {
          pending.current = p;
          setRecovery(true);
        }
      }
    } catch {
      setError("Enable device storage before spending test credits.");
    }
  }, [storageKey]);
  async function send(command: Record<string, unknown>) {
    const key = JSON.stringify(command);
    if (pending.current && pending.current.key !== key)
      throw Error("Check the pending request first");
    const request = pending.current?.id ?? crypto.randomUUID();
    pending.current = { key, id: request };
    // Persist only the idempotency envelope, never credentials or financial truth.
    // A lost response or app restart must retrieve this operation, not purchase again.
    localStorage.setItem(storageKey, JSON.stringify(pending.current));
    setRecovery(true);
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/test-wallet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ request, command }),
      });
      const data = await r.json();
      if (!r.ok) {
        if (data.outcome === "rejected") {
          pending.current = null;
          localStorage.removeItem(storageKey);
          setRecovery(false);
        }
        throw Error(data.error);
      }
      setS(data.state);
      pending.current = null;
      localStorage.removeItem(storageKey);
      setRecovery(false);
      return data.result;
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Connection interrupted. Retry the same action to retrieve its receipt.",
      );
      throw e;
    } finally {
      setBusy(false);
    }
  }
  const act = (c: Record<string, unknown>) => void send(c).catch(() => {});
  const mine = s.cards.filter((c) => c.owner === s.member);
  const p = s.packs.find((p) => p.id === pack);
  const label = (id: string) =>
    s.peers.find((p) => p.id === id)?.label ?? "Invited member";
  return (
    <main className="test-wallet">
      <header>
        <p className="eyebrow">PRIVATE BETA</p>
        <h1>Test wallet</h1>
        <p>
          Test Docked Credits · no cash value or withdrawals. Your normal cards
          and free swaps stay separate.
        </p>
        <Link href="/fantasy/cards">Back to your main collection</Link>
      </header>
      <section>
        <h2>
          {s.wallet.spendable.toLocaleString()}{" "}
          <small>test Docked Credits</small>
        </h2>
        <p>
          Available {s.wallet.available.toLocaleString()} · reserved{" "}
          {s.wallet.reserved.toLocaleString()}
        </p>
      </section>
      {error && <p role="alert">{error}</p>}
      {recovery && (
        <p role="status">
          A test transaction is awaiting confirmation.{" "}
          <button
            disabled={busy}
            onClick={() => {
              if (pending.current) act(JSON.parse(pending.current.key));
            }}
          >
            Retry pending transaction
          </button>
        </p>
      )}
      <section>
        <h2>Single-card packs</h2>
        <p>
          Random cards from a separate, finite test edition. Premium = RARE;
          Elite = ELITE. These cards do not enter scored teams.
        </p>
        <div className="test-wallet-grid">
          {s.products.map((p) => (
            <article key={p.id}>
              <h3>{p.name}</h3>
              <p>
                {p.price.toLocaleString()} test credits · {p.tier}
              </p>
              <button
                disabled={busy || s.wallet.spendable < p.price}
                onClick={() => {
                  if (
                    confirm(
                      `Buy ${p.name} for ${p.price.toLocaleString()} test credits?`,
                    )
                  )
                    act({
                      kind: "buy-pack",
                      product: p.id,
                      confirmed: true,
                      policy: s.policy,
                    });
                }}
              >
                Buy {p.tier === "RARE" ? "Premium" : "Elite"} pack
              </button>
            </article>
          ))}
        </div>
        {s.packs.map((p) => (
          <div className="test-wallet-row" key={p.id}>
            <span>
              {p.name} · {p.status === "SEALED" ? "Ready to open" : "Opened"}
            </span>
            <button disabled={busy} onClick={() => setPack(p.id)}>
              {p.status === "SEALED" ? "Open pack" : "Replay saved pack"}
            </button>
          </div>
        ))}
      </section>
      {p && (
        <PackOpening
          key={p.id}
          userId={s.member}
          name={p.name}
          receipt={p.receipt}
          ownedIds={mine.map((c) => c.id)}
          openPack={async () =>
            (await send({
              kind: "open-pack",
              entitlement: p.id,
            })) as PackReceipt
          }
          onClose={() => setPack(null)}
          onViewCard={(c) => {
            setPack(null);
            setDetails(c.id);
          }}
          collectionHref="/fantasy/test-wallet#collection"
          teamHref={null}
        />
      )}
      <section id="collection">
        <h2>Your test collection</h2>
        <div className="test-wallet-grid">
          {mine.map((c) => (
            <article key={c.id}>
              <FantasyCardArtwork card={c} />
              <button onClick={() => setDetails(c.id)}>
                Ownership history
              </button>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const price = Number(
                    new FormData(e.currentTarget).get("price"),
                  );
                  const fee = Math.floor((price * 750 + 5000) / 10000);
                  if (
                    confirm(
                      `List for ${price} test credits? Seller fee ${fee}; you receive ${price - fee}.`,
                    )
                  )
                    act({ kind: "list", card: c.id, price });
                }}
              >
                <label>
                  Listing price
                  <input
                    name="price"
                    type="number"
                    min="1"
                    max="1000000000"
                    defaultValue="100"
                    required
                  />
                </label>
                <button disabled={busy}>Review listing</button>
              </form>
            </article>
          ))}
        </div>
        {!mine.length && (
          <p>Open a purchased pack to add your first test card.</p>
        )}
      </section>
      {details && (
        <section>
          <h2>Test ownership history</h2>
          {s.cards
            .find((c) => c.id === details)
            ?.history.map((h, i) => (
              <p key={i}>
                {new Date(h.at).toLocaleString()} ·{" "}
                {h.from ? label(h.from) : "Test edition"} → {label(h.to)} ·{" "}
                {h.reference}
              </p>
            ))}
          <button onClick={() => setDetails(null)}>Close history</button>
        </section>
      )}
      <section>
        <h2>Test marketplace</h2>
        <p>
          7.5% seller commission, rounded to the nearest whole credit. All cards
          and proceeds stay in this test wallet.
        </p>
        {s.listings
          .filter((l) => l.status === "OPEN")
          .map((l) => (
            <article key={l.id}>
              <h3>
                {s.cards.find((c) => c.id === l.card)?.name} · {label(l.member)}
              </h3>
              <p>
                {l.price} test credits · fee{" "}
                {Math.floor((l.price * 750 + 5000) / 10000)} · seller receives{" "}
                {l.price - Math.floor((l.price * 750 + 5000) / 10000)}
              </p>
              {l.member === s.member ? (
                <button
                  disabled={busy}
                  onClick={() => act({ kind: "cancel-listing", listing: l.id })}
                >
                  Cancel listing
                </button>
              ) : (
                <button
                  disabled={busy}
                  onClick={() => {
                    if (confirm(`Buy this test card for ${l.price} credits?`))
                      act({
                        kind: "buy",
                        listing: l.id,
                        expectedPrice: l.price,
                        policy: s.policy,
                        confirmed: true,
                      });
                  }}
                >
                  Buy test card
                </button>
              )}
            </article>
          ))}
      </section>
      <section>
        <h2>Test card swaps</h2>
        <p>
          50 test credits each, charged only when both transfers complete. No
          fee for rejection or cancellation. Choose the other member's listed
          test card to propose a swap.
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget),
              listing = s.listings.find((l) => l.id === f.get("take"));
            if (listing)
              act({
                kind: "offer",
                other: listing.member,
                give: [String(f.get("give"))],
                take: [listing.card],
                feeEach: 50,
              });
          }}
        >
          <label>
            Your card
            <select name="give" required>
              {mine.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} · {c.tier} #{c.serial}
                </option>
              ))}
            </select>
          </label>
          <label>
            Their listed card
            <select name="take" required>
              {s.listings
                .filter((l) => l.status === "OPEN" && l.member !== s.member)
                .map((l) => (
                  <option value={l.id} key={l.id}>
                    {s.cards.find((c) => c.id === l.card)?.name} ·{" "}
                    {label(l.member)}
                  </option>
                ))}
            </select>
          </label>
          <button disabled={busy}>Propose swap · 50 each</button>
        </form>
        {s.swaps.map((x) => (
          <article key={x.id}>
            <h3>
              {x.status} · {label(x.member)} ↔ {label(x.other)}
            </h3>
            <p>
              Offer:{" "}
              {x.give
                .map((id) => s.cards.find((c) => c.id === id)?.name + " " + id)
                .join(", ")}
            </p>
            <p>
              In return:{" "}
              {x.take
                .map((id) => s.cards.find((c) => c.id === id)?.name + " " + id)
                .join(", ")}
            </p>
            <p>Each participant pays 50 test credits on completion.</p>
            {x.status === "OPEN" &&
              (x.member === s.member ? (
                <button
                  disabled={busy}
                  onClick={() => act({ kind: "cancel-swap", swap: x.id })}
                >
                  Cancel offer
                </button>
              ) : (
                <>
                  <button
                    disabled={busy}
                    onClick={() => {
                      if (
                        confirm(
                          "Accept both sides of this swap and pay 50 test credits?",
                        )
                      )
                        act({ kind: "accept", swap: x.id });
                    }}
                  >
                    Accept swap
                  </button>
                  <button
                    disabled={busy}
                    onClick={() => act({ kind: "reject", swap: x.id })}
                  >
                    Reject offer
                  </button>
                </>
              ))}
          </article>
        ))}
      </section>
      <section>
        <h2>Your transaction history</h2>
        {s.history.map((h) => (
          <p key={h.id}>
            {new Date(h.at).toLocaleString()} · {h.reason} ·{" "}
            {h.change > 0 ? "+" : ""}
            {h.change} <small>{h.id}</small>
          </p>
        ))}
      </section>
      {s.ownerReport && (
        <section>
          <h2>Owner-only test report</h2>
          <p>
            No cash backing or payment provider is connected. Grants remain
            restricted to the audited owner operation.
          </p>
          <pre>{JSON.stringify(s.ownerReport, null, 2)}</pre>
        </section>
      )}
    </main>
  );
}

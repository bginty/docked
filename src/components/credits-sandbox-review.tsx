"use client";
import { useEffect, useRef, useState } from "react";
import PackOpening from "./pack-opening";
import type { PackReceipt } from "../core/pack-opening";
type Review = {
  wallets: Record<
    string,
    {
      available: number;
      pending: number;
      reserved: number;
      withdrawable: number;
      spendable: number;
    }
  >;
  admin: Record<string, unknown>;
  packs: { id: string; member: string; product: string; status: string }[];
  journal: { id: string; reason: string }[];
  cards: {
    id: string;
    owner: string;
    locked: boolean;
    history: {
      from: string | null;
      to: string;
      reference: string;
      at: number;
    }[];
  }[];
  listings: {
    id: string;
    member: string;
    card: string;
    price: number;
    fee: number;
    net: number;
    status: string;
  }[];
  swaps: {
    id: string;
    member: string;
    other: string;
    give: string[];
    take: string[];
    status: string;
  }[];
  withdrawals: { id: string; member: string; amount: number; status: string }[];
};
export function CreditsSandboxReview() {
  const pendingRequests = useRef(new Map<string, string>());
  const [data, setData] = useState<Review | null>(null),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [pack, setPack] = useState<{ id: string; member: string } | null>(null),
    [member, setMember] = useState("synthetic-alice");
  const refresh = async () => setData(await (await fetch("/data")).json());
  useEffect(() => {
    void refresh().catch(() =>
      setError("Sandbox unavailable. Restart the local review server."),
    );
  }, []);
  async function send(op: string, fields: Record<string, unknown> = {}) {
    const fingerprint = JSON.stringify({ op, member, ...fields });
    const request =
      pendingRequests.current.get(fingerprint) ?? crypto.randomUUID();
    pendingRequests.current.set(fingerprint, request);
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const r = await fetch("/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          op,
          member,
          request,
          ...fields,
        }),
      });
      const body = await r.json();
      if (!r.ok) throw Error(body.error);
      await refresh();
      pendingRequests.current.delete(fingerprint);
      setMessage("Sandbox transaction recorded.");
      return body;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sandbox request failed");
      throw e;
    } finally {
      setBusy(false);
    }
  }
  if (!data) return <p>{error || "Loading the isolated financial sandbox…"}</p>;
  const w = data.wallets[member];
  return (
    <main className="credit-review">
      <img
        src="/brand/docked/logos/docked-wordmark-compact-800w.webp"
        alt="Docked"
        width="190"
        onError={(e) => {
          e.currentTarget.hidden = true;
        }}
      />
      <p className="eyebrow">DOCKED · FINANCIAL SANDBOX</p>
      <h1>Docked Credits</h1>
      <p>
        No real money, identity documents or friends-beta accounts. These
        fictional wallets use PostgreSQL. Product-policy examples are not
        approved live terms.
      </p>
      <label>
        Fictional member{" "}
        <select value={member} onChange={(e) => setMember(e.target.value)}>
          <option value="synthetic-alice">Alice</option>
          <option value="synthetic-bob">Bob</option>
        </select>
      </label>
      <section aria-label="Wallet" className="credit-metrics">
        {(
          [
            "available",
            "pending",
            "reserved",
            "spendable",
            "withdrawable",
          ] as const
        ).map((k) => (
          <article key={k}>
            <span>{k}</span>
            <strong>{w[k].toLocaleString()}</strong>
            <small>Docked Credits · sandbox</small>
          </article>
        ))}
      </section>
      <p>
        Withdrawable is a subset of available, not an extra balance. 100
        eligible credits = A$1 in the proposed cash model; this sandbox cannot
        redeem cash. Match points are separate.
      </p>
      <section>
        <h2>Deposit and bonus</h2>
        <p>
          A$49 → 4,900 credits + one Premium single-card pack. A$99 → 9,900
          credits + one Elite single-card pack. The bonus costs no credits.
        </p>
        <p>
          Example promotion cap: one per product per fictional member. Live
          bonus frequency and edition supply remain undecided.
        </p>
        <div className="credit-actions">
          {[49, 99].map((n) => (
            <button
              key={n}
              disabled={busy}
              onClick={() =>
                void send("deposit", {
                  product: n === 49 ? "premium-single-v1" : "elite-single-v1",
                }).catch(() => {})
              }
            >
              Simulate A${n} deposit
            </button>
          ))}
        </div>
      </section>
      <section>
        <h2>Buy a single-card pack</h2>
        <p>
          Premium = RARE; Elite = ELITE. Random selection from the reserved
          disclosed pool. No scoring multiplier. Credit purchases receive no
          deposit bonus.
        </p>
        <div className="credit-actions">
          {[4900, 9900].map((n) => (
            <button
              key={n}
              disabled={busy}
              onClick={() => {
                if (
                  window.confirm(
                    `Spend ${n.toLocaleString()} sandbox Docked Credits?`,
                  )
                )
                  void send("buy-pack", {
                    product:
                      n === 4900 ? "premium-single-v1" : "elite-single-v1",
                  }).catch(() => {});
              }}
            >
              Buy {n === 4900 ? "Premium" : "Elite"} · {n.toLocaleString()}{" "}
              credits
            </button>
          ))}
        </div>
        {data.packs
          .filter((p) => p.member === member)
          .map((p) => (
            <article key={p.id} className="credit-pack">
              <span>
                {p.product} · {p.status}
              </span>
              <button
                disabled={busy || p.status === "REVIEW"}
                onClick={() => setPack({ id: p.id, member })}
              >
                {p.status === "OPENED" ? "Replay" : "Open"} pack
              </button>
            </article>
          ))}
      </section>
      <section>
        <h2>Sandbox marketplace</h2>
        <p>
          Seller commission is 7.5%, rounded half-up to whole credits. Mixed
          card-plus-credit offers are disabled. Saved or locked lineup cards
          cannot transfer.
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            const price = Number(f.get("price")),
              fee = Math.floor((price * 750 + 5000) / 10000);
            if (
              window.confirm(
                `List for ${price} Docked Credits? Seller fee ${fee}; net ${price - fee}.`,
              )
            )
              void send("list", {
                card: String(f.get("card")),
                amount: price,
              }).catch(() => {});
          }}
        >
          <label>
            Owned card{" "}
            <select name="card" required>
              {data.cards
                .filter((c) => c.owner === member)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.id}
                    {c.locked ? " · locked" : ""}
                  </option>
                ))}
            </select>
          </label>
          <label>
            Price in Docked Credits{" "}
            <input
              name="price"
              type="number"
              min="1"
              max="10000"
              defaultValue="100"
              required
            />
          </label>
          <button disabled={busy}>Review listing</button>
        </form>
        {data.listings.map((l) => (
          <article key={l.id}>
            <p>
              {l.card} · {l.status}
              <br />
              Price {l.price} · fee {l.fee} · seller receives {l.net}
            </p>
            {l.status === "OPEN" && l.member !== member && (
              <button
                disabled={busy}
                onClick={() => {
                  if (
                    window.confirm(
                      `Buy for ${l.price} sandbox Docked Credits? Seller receives ${l.net}.`,
                    )
                  )
                    void send("buy", {
                      reference: l.id,
                      amount: l.price,
                    }).catch(() => {});
                }}
              >
                Confirm purchase
              </button>
            )}
          </article>
        ))}
      </section>
      <section>
        <h2>Pure card swaps</h2>
        <p>
          50 Docked Credits each, 100 total, only when both transfers succeed.
          No fee for rejected, cancelled or expired offers. Ownership and funds
          are rechecked at acceptance. In this proposed sandbox policy,
          exchanging a restricted bonus or promotional card restricts resale
          proceeds for every card in that swap.
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            void send("offer", {
              card: String(f.get("give")),
              take: String(f.get("take")),
            }).catch(() => {});
          }}
        >
          <label>
            Your card{" "}
            <select name="give" required>
              {data.cards
                .filter((c) => c.owner === member)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.id}
                  </option>
                ))}
            </select>
          </label>
          <label>
            Their card{" "}
            <select name="take" required>
              {data.cards
                .filter((c) => c.owner !== member)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.id}
                  </option>
                ))}
            </select>
          </label>
          <button disabled={busy}>Propose swap · 50 credits each</button>
        </form>
        {data.swaps.map((o) => (
          <article key={o.id}>
            <p>
              {o.give.join(", ")} ↔ {o.take.join(", ")}
              <br />
              {o.status} · fee 50 each
            </p>
            {o.status === "OPEN" &&
              (o.member === member ? (
                <button
                  disabled={busy}
                  onClick={() =>
                    void send("cancel-swap", { reference: o.id }).catch(
                      () => {},
                    )
                  }
                >
                  Cancel offer
                </button>
              ) : (
                <div className="credit-actions">
                  <button
                    disabled={busy}
                    onClick={() => {
                      if (
                        window.confirm(
                          "Accept both cards and a 50-credit fee from each participant?",
                        )
                      )
                        void send("accept", { reference: o.id }).catch(
                          () => {},
                        );
                    }}
                  >
                    Accept · pay 50 credits
                  </button>
                  <button
                    disabled={busy}
                    onClick={() =>
                      void send("reject", { reference: o.id }).catch(() => {})
                    }
                  >
                    Reject offer
                  </button>
                </div>
              ))}
          </article>
        ))}
        {data.cards
          .filter((c) => c.owner === member)
          .map((c) => (
            <details key={c.id}>
              <summary>Ownership history · {c.id}</summary>
              {c.history.map((h, i) => (
                <p key={i}>
                  {h.from ?? "Finite inventory"} → {h.to}
                  <br />
                  {h.reference}
                </p>
              ))}
            </details>
          ))}
      </section>
      <section>
        <h2>Withdrawal review</h2>
        <p>
          100 eligible credits = A$1. Current KYC and an owned, verified
          beneficiary are required. Example minimum: 100 credits; example fee:
          zero. No real payout is sent. Uncertain payouts stay reserved until
          reconciliation.
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            if (
              window.confirm(
                "Reserve these synthetic credits for withdrawal review?",
              )
            )
              void send("withdraw", {
                amount: Number(f.get("withdrawal")),
              }).catch(() => {});
          }}
        >
          <label>
            Eligible Docked Credits{" "}
            <input
              name="withdrawal"
              type="number"
              min="100"
              max="10000"
              defaultValue="100"
              required
            />
          </label>
          <button disabled={busy}>Request sandbox withdrawal</button>
        </form>
        {data.withdrawals
          .filter((w) => w.member === member)
          .map((w) => (
            <p key={w.id}>
              {w.amount} Docked Credits · {w.status}
            </p>
          ))}
      </section>
      <section>
        <h2>Owner tools · isolated operator fixture</h2>
        <p>
          This local operator review session simulates owner AAL2. It is not a
          real owner login or a hosted admin endpoint. Member calls to issuance
          commands are denied.
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            void send("promotion", {
              amount: Number(f.get("amount")),
              campaign: String(f.get("campaign")),
              reason: String(f.get("reason")),
            }).catch(() => {});
          }}
        >
          <label>
            Recipient <input readOnly value={member} />
          </label>
          <label>
            Docked Credits{" "}
            <input
              name="amount"
              type="number"
              min="1"
              max="10000"
              defaultValue="250"
              required
            />
          </label>
          <label>
            Campaign reference{" "}
            <input name="campaign" defaultValue="review-campaign" required />
          </label>
          <label>
            Reason{" "}
            <input
              name="reason"
              defaultValue="Synthetic promotion review"
              minLength={12}
              required
            />
          </label>
          <p>
            Category: promotional. Non-withdrawable; restricted resale. Example
            campaign limit: 10,000. Immutable issuance and compensating
            reversals only.
          </p>
          <label>
            <input type="checkbox" required /> Confirm this fictional,
            non-redeemable award
          </label>
          <button disabled={busy}>Issue sandbox promotional credits</button>
        </form>
      </section>
      {error && <p role="alert">{error}</p>}
      {message && <p role="status">{message}</p>}
      <section>
        <h2>Cash backing and owner report</h2>
        <p>
          Deposits are liabilities, not profit. Actual provider/bank balances,
          fees and reserves are unknown. No live wallet, payment or payout
          provider is enabled.
        </p>
        <dl>
          {Object.entries(
            (data.admin.categories ?? {}) as Record<string, number>,
          ).map(([k, v]) => (
            <div key={k}>
              <dt>{k} credits outstanding</dt>
              <dd>{v.toLocaleString()}</dd>
            </div>
          ))}
          {Object.entries(data.admin)
            .filter(
              ([, v]) =>
                v === null || typeof v === "number" || typeof v === "string",
            )
            .map(([k, v]) => (
              <div key={k}>
                <dt>{k.replace(/([a-z])([A-Z])/g, "$1 $2")}</dt>
                <dd>{v === null ? "Unknown / not connected" : String(v)}</dd>
              </div>
            ))}
        </dl>
      </section>
      <section>
        <h2>Immutable transaction history</h2>
        {data.journal
          .slice(-10)
          .reverse()
          .map((j) => (
            <p key={j.id}>
              <strong>{j.id}</strong>
              <br />
              {j.reason}
              {j.id.endsWith("_issue") && (
                <button
                  disabled={busy}
                  onClick={() => {
                    if (
                      window.confirm(
                        "Compensate this synthetic award? Spent funds will be held for recovery review.",
                      )
                    )
                      void send("reverse", {
                        reference: j.id,
                        reason:
                          "Operator requested synthetic compensating reversal",
                      }).catch(() => {});
                  }}
                >
                  Review compensating reversal
                </button>
              )}
            </p>
          ))}
      </section>
      {pack && (
        <PackOpening
          userId={pack.member}
          name="Sandbox single-card pack"
          ownedIds={[]}
          onClose={() => setPack(null)}
          onViewCard={() => {}}
          openPack={async () => {
            const result = await send("open-pack", {
              entitlement: pack.id,
              member: pack.member,
            });
            return result as PackReceipt;
          }}
        />
      )}
    </main>
  );
}

"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { MemberTestView } from "@/core/member-test-wallet";
import { rarities, rarityRule } from "@/core/card-rarity";
import {
  newestPacks,
  packBalance,
  packTab,
  packTitle as title,
  type PackTab,
} from "@/core/pack-presentation";
import { FantasySheet } from "./fantasy-player-sheet";
import { PackArtwork } from "./pack-artwork";
import { WeeklyCorePanel } from "./weekly-core-panel";
import { StarterPackHistory } from "./starter-pack-history";
type Product = MemberTestView["products"][number];
function FamilyDisclosures({ p }: { p: Product }) {
  return (
    <div className="pack-disclosures">
      {p.weights && (
        <details>
          <summary>Rarity Chances</summary>
          <table>
            <caption>Per card · before supply checks</caption>
            <thead>
              <tr>
                <th>Rarity</th>
                <th>Chance</th>
              </tr>
            </thead>
            <tbody>
              {rarities
                .filter((r) => p.weights![r] > 0)
                .map((r) => (
                  <tr key={r}>
                    <td>{rarityRule(r).label}</td>
                    <td>{p.weights![r] / 100}%</td>
                  </tr>
                ))}
            </tbody>
          </table>
          {!!p.odds?.excluded.length && (
            <p>{p.odds.excluded.join(", ")}: not included.</p>
          )}
        </details>
      )}
      <details>
        <summary>Pack Details</summary>
        <p>
          1, 3 or 9 cards · {p.eligiblePlayers} eligible players
          {p.positions.length ? ` · ${p.positions.join(", ")}` : ""}.
        </p>
        <p>
          {p.odds?.guarantee ??
            (Object.keys(p.guaranteedSlots).length
              ? `Guaranteed slots: ${Object.entries(p.guaranteedSlots)
                  .map(([slot, r]) => `${Number(slot) + 1}: ${r}`)
                  .join(", ")}`
              : "No guaranteed rarity.")}
        </p>
        <p>
          {p.duplicatePlayers === "n/a"
            ? "Single-card pack."
            : p.duplicatePlayers === "deny"
              ? "Different players in each pack."
              : "Player selection follows the pack’s saved duplicate policy."}
        </p>
        <p>
          Rarity chances apply before supply checks. If the pack cannot be
          fulfilled, the purchase fails without charge or substitution.
          Completed-pack frequencies may differ near exhaustion.
        </p>
      </details>
    </div>
  );
}
export function PackShop({
  state: s,
  busy,
  recovery,
  purchase,
  refresh,
  open,
}: {
  state: MemberTestView;
  busy: boolean;
  recovery: boolean;
  purchase: (product: Product) => Promise<unknown>;
  refresh: () => Promise<void>;
  open: (id: string, replay: boolean) => void;
}) {
  const [tab, setTab] = useState<PackTab>("buy"),
    [review, setReview] = useState<Product | null>(null);
  const [error, setError] = useState(""),
    [submitting, setSubmitting] = useState(false);
  const flight = useRef(false);
  useEffect(() => {
    const read = () => setTab(packTab(location.search, location.hash));
    read();
    window.addEventListener("popstate", read);
    window.addEventListener("hashchange", read);
    return () => {
      window.removeEventListener("popstate", read);
      window.removeEventListener("hashchange", read);
    };
  }, []);
  function choose(next: PackTab) {
    setTab(next);
    const url = new URL(location.href);
    url.searchParams.set("packs", next);
    url.hash = next === "history" ? "pack-history" : "packs";
    history.pushState(null, "", url);
  }
  async function confirm() {
    if (!review || flight.current || recovery) return;
    flight.current = true;
    setSubmitting(true);
    setError("");
    try {
      await purchase(review);
      setReview(null);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Purchase could not be confirmed.",
      );
    } finally {
      flight.current = false;
      setSubmitting(false);
    }
  }
  const historyPacks = newestPacks(s.packs);
  const unopened = historyPacks.filter((p) => p.status === "SEALED");
  const credits = (n: number) => n.toLocaleString("en-AU");
  return (
    <section className="pack-shop" id="packs" aria-label="Docked packs">
      <header className="pack-shop-heading">
        <div>
          <p className="eyebrow">CARDS / PACKS</p>
          <h1>{s.economyEnabled ? "NFL Packs" : "Your packs"}</h1>
        </div>
        <p className="pack-shop-balance">
          <strong>{credits(s.wallet.spendable)}</strong>
          <span>test Docked Credits</span>
        </p>
      </header>
      <nav className="pack-tabs" aria-label="Pack navigation">
        {(
          [
            ["buy", "Buy Packs"],
            ["mine", "My Packs"],
            ["history", "History"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            className="pack-control"
            aria-current={tab === id ? "page" : undefined}
            onClick={() => choose(id)}
          >
            {label}
          </button>
        ))}
      </nav>
      {tab === "buy" && (
        <div className="pack-families">
          {["PREMIUM", "STANDARD", "OTHER"].map((family) => {
            const products = s.products
              .filter((p) =>
                family === "OTHER"
                  ? !["PREMIUM", "STANDARD"].includes(p.tier)
                  : p.tier === family,
              )
              .sort((a, b) => b.cards - a.cards);
            if (!products.length) return null;
            return (
              <section
                className="pack-family"
                data-family={family}
                key={family}
              >
                <header>
                  <h2>
                    {family === "PREMIUM"
                      ? "Premium"
                      : family === "STANDARD"
                        ? "Standard"
                        : "Packs"}
                  </h2>
                  <p>
                    {family === "PREMIUM"
                      ? "Ultra Rare, Legendary or Icon on every card."
                      : family === "STANDARD"
                        ? "Rare, Elite, Ultra Rare, Legendary or Icon."
                        : "Choose your pack."}
                  </p>
                  <FamilyDisclosures p={products[0]} />
                </header>
                <div className="pack-product-grid">
                  {products.map((p) => (
                    <article className="pack-product" key={p.id}>
                      <PackArtwork
                        name={title(p)}
                        premium={p.tier === "PREMIUM"}
                      />
                      <h3>{title(p)}</h3>
                      <p className="pack-product-guarantee">
                        {p.cards} {p.cards === 1 ? "card" : "cards"}
                      </p>
                      <p className="pack-price">
                        <strong>{credits(p.price)}</strong> test credits
                      </p>
                      <button
                        className="pack-control primary"
                        aria-label={`Buy ${title(p)}`}
                        disabled={
                          busy ||
                          recovery ||
                          !p.available ||
                          s.wallet.spendable < p.price
                        }
                        onClick={() => {
                          setError("");
                          setReview(p);
                        }}
                      >
                        Buy{" "}
                        {p.tier === "PREMIUM"
                          ? "Premium"
                          : p.tier === "STANDARD"
                            ? "Standard"
                            : p.name}
                      </button>
                      {!p.available ? (
                        <p className="small-note">Currently unavailable</p>
                      ) : (
                        s.wallet.spendable < p.price && (
                          <p className="small-note">
                            Insufficient available test credits
                          </p>
                        )
                      )}
                    </article>
                  ))}
                </div>
              </section>
            );
          })}
          {s.economyEnabled && (
            <p className="small-note">
              Core cards are exclusive to weekly starter packs.
            </p>
          )}
        </div>
      )}
      {tab !== "buy" && (
        <section id="pack-history" className="pack-library">
          <h2>{tab === "mine" ? "My Packs" : "Pack history"}</h2>
          <WeeklyCorePanel member={s.member} history={tab === "history"} />
          {tab === "history" && <StarterPackHistory member={s.member} />}
          {(tab === "mine" ? unopened : historyPacks).length === 0 && (
            <p>
              {tab === "mine"
                ? "No unopened purchased packs. Weekly rewards are shown above."
                : "Your purchased pack history will appear here."}
            </p>
          )}
          {(tab === "mine" ? unopened : historyPacks).map((p) => (
            <article
              className="pack-history-row"
              key={p.id}
              data-pack-id={p.id}
            >
              <PackArtwork
                name={title(p)}
                premium={p.type === "PREMIUM"}
                compact
              />
              <div>
                <h3>{title(p)}</h3>
                <p>
                  {p.status === "SEALED" ? "Ready to open" : "Opened"} ·{" "}
                  {p.cardCount ?? p.receipt?.cards.length ?? "—"}{" "}
                  {(p.cardCount ?? p.receipt?.cards.length) === 1
                    ? "card"
                    : "cards"}
                </p>
                <p className="small-note">
                  {p.purchasedAt
                    ? new Date(p.purchasedAt).toLocaleString("en-AU", {
                        timeZone: "Australia/Sydney",
                        dateStyle: "medium",
                        timeStyle: "short",
                      })
                    : "Date unavailable"}
                  {p.paidCredits !== null
                    ? ` · ${credits(p.paidCredits)} test credits`
                    : ""}
                </p>
              </div>
              <button
                className="pack-control secondary"
                disabled={busy || recovery}
                onClick={() => open(p.id, p.status === "OPENED")}
              >
                {p.status === "SEALED" ? "Open Pack" : "Replay"}
              </button>
            </article>
          ))}
          {tab === "history" && (
            <p className="small-note">
              Replays show your original result. No credits spent and no new
              cards awarded.
            </p>
          )}
        </section>
      )}
      <p className="pack-no-cash">Test Docked Credits · No cash value</p>
      <Link className="pack-control secondary" href="/fantasy/cards">
        View Collection
      </Link>
      {review && (
        <FantasySheet
          title="Confirm purchase"
          className="pack-purchase-sheet"
          onClose={() => setReview(null)}
        >
          <div className="pack-purchase-review">
            <PackArtwork
              name={title(review)}
              premium={review.tier === "PREMIUM"}
            />
            <h3>{title(review)}</h3>
            <p>{review.odds?.headline ?? `${review.cards} cards`}</p>
            <dl>
              <div>
                <dt>Cost</dt>
                <dd>{credits(review.price)} test credits</dd>
              </div>
              <div>
                <dt>Available</dt>
                <dd>{credits(s.wallet.spendable)} test credits</dd>
              </div>
              <div>
                <dt>After purchase</dt>
                <dd>
                  {credits(packBalance(s.wallet.spendable, review.price))} test
                  credits
                </dd>
              </div>
            </dl>
            {review.odds?.guarantee && (
              <p className="small-note">{review.odds.guarantee}</p>
            )}
            {error && <p role="alert">{error}</p>}
            {recovery && !submitting && (
              <p role="status">
                The outcome needs confirmation. Close this review and use “Retry
                pending transaction” to retrieve the same purchase safely.
              </p>
            )}
            {error && !recovery && (
              <button
                className="pack-control secondary"
                disabled={busy}
                onClick={async () => {
                  try {
                    await refresh();
                    setReview(null);
                  } catch {
                    setError(
                      "Could not refresh pack details. Please try again.",
                    );
                  }
                }}
              >
                Refresh packs and review again
              </button>
            )}
            <div className="pack-review-actions">
              <button
                className="pack-control secondary"
                onClick={() => setReview(null)}
              >
                Cancel
              </button>
              <button
                className="pack-control primary"
                disabled={
                  busy ||
                  submitting ||
                  recovery ||
                  !!error ||
                  packBalance(s.wallet.spendable, review.price) < 0
                }
                onClick={() => void confirm()}
              >
                {submitting ? "Confirming…" : "Confirm Purchase"}
              </button>
            </div>
            <p className="pack-no-cash">
              {submitting
                ? "Confirming your purchase. Closing this review does not cancel a submitted request."
                : "No credits deducted until you confirm. Test credits have no cash value."}
            </p>
          </div>
        </FantasySheet>
      )}
    </section>
  );
}

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
import { boundedFetch } from "@/core/bounded-request";
import type { CouponQuote } from "@/core/pack-coupons";
import type { memberCoupon } from "@/server/pack-coupons";
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
          {p.sport === "basketball" ? "9 cards" : "1, 3 or 9 cards"} ·{" "}
          {p.eligiblePlayers} eligible players
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
  sport = "nfl",
  state: s,
  busy,
  recovery,
  purchase,
  refresh,
  open,
}: {
  state: MemberTestView;
  sport?: "nfl" | "basketball";
  busy: boolean;
  recovery: boolean;
  purchase: (product: Product, coupon?: CouponQuote) => Promise<unknown>;
  refresh: () => Promise<void>;
  open: (id: string, replay: boolean) => void;
}) {
  const [tab, setTab] = useState<PackTab>("buy"),
    [review, setReview] = useState<Product | null>(null);
  const [error, setError] = useState(""),
    [submitting, setSubmitting] = useState(false);
  const flight = useRef(false);
  const [code, setCode] = useState(""),
    [coupon, setCoupon] = useState<Awaited<
      ReturnType<typeof memberCoupon>
    > | null>(null),
    [couponBusy, setCouponBusy] = useState(false),
    [couponError, setCouponError] = useState("");
  const [reviewCoupon, setReviewCoupon] = useState<CouponQuote | undefined>();
  const couponFlight = useRef(false);
  const quoteFor = (p: Product) =>
    coupon?.quotes.find((q) => q.product === p.id)?.quote ?? undefined;
  const priceFor = (p: Product) => quoteFor(p)?.charge ?? p.price;
  async function applyCoupon() {
    if (couponFlight.current) return;
    couponFlight.current = true;
    setCouponBusy(true);
    setCouponError("");
    setCoupon(null);
    try {
      const r = await boundedFetch("/api/pack-coupons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const v = await r.json();
      if (!r.ok)
        throw Error(v.error ?? "Coupon validation failed. Please retry.");
      setCoupon(v);
      setCode(v.code);
    } catch (e) {
      setCouponError(
        e instanceof Error
          ? e.message
          : "Coupon validation failed. Please retry.",
      );
    } finally {
      couponFlight.current = false;
      setCouponBusy(false);
    }
  }
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
      await purchase(review, reviewCoupon);
      setCoupon(null);
      setReview(null);
    } catch (e) {
      if (
        e instanceof Error &&
        /coupon|offer changed/i.test(e.message) &&
        !recovery
      ) {
        setCoupon(null);
        setReviewCoupon(undefined);
        setReview(null);
        setCouponError(
          `${e.message} Apply the code again and review the updated price.`,
        );
      }
      setError(
        e instanceof Error ? e.message : "Purchase could not be confirmed.",
      );
    } finally {
      flight.current = false;
      setSubmitting(false);
    }
  }
  const sportProducts = s.products.filter((p) => (p.sport ?? "nfl") === sport);
  const historyPacks = newestPacks(
    s.packs.filter((p) => (p.sport ?? "nfl") === sport),
  );
  const unopened = historyPacks.filter((p) => p.status === "SEALED");
  const credits = (n: number) => n.toLocaleString("en-AU");
  return (
    <section className="pack-shop" id="packs" aria-label="Docked packs">
      <header className="pack-shop-heading">
        <div>
          <p className="eyebrow">CARDS / PACKS</p>
          <h1>
            {s.economyEnabled
              ? `${sport === "basketball" ? "NBA" : "NFL"} Packs`
              : "Your packs"}
          </h1>
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
          {sport === "nfl" && (
            <form
              className="pack-coupon-panel"
              onSubmit={(e) => {
                e.preventDefault();
                void applyCoupon();
              }}
            >
              <label>
                Have a coupon?
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  maxLength={32}
                  autoCapitalize="characters"
                  autoComplete="off"
                  disabled={couponBusy || !!coupon}
                />
              </label>
              <div className="actions">
                <button
                  className="pack-control primary"
                  disabled={couponBusy || !code.trim() || !!coupon}
                >
                  {couponBusy ? "Checking…" : "Apply"}
                </button>
                {coupon && (
                  <button
                    type="button"
                    className="pack-control secondary"
                    onClick={() => {
                      setCoupon(null);
                      setCode("");
                      setCouponError("");
                    }}
                  >
                    Remove
                  </button>
                )}
              </div>
              {couponError && <p role="alert">{couponError}</p>}
              {coupon && (
                <p role="status">
                  <strong>{coupon.code} applied</strong> ·{" "}
                  {coupon.terms.type === "percent"
                    ? `${coupon.terms.value}%`
                    : `${coupon.terms.value.toLocaleString("en-AU")} credits`}{" "}
                  off eligible packs, up to{" "}
                  {coupon.terms.maximumDiscount.toLocaleString("en-AU")} credits
                  · {coupon.terms.accountLimit} use(s) per account
                  {coupon.terms.firstPurchaseOnly
                    ? " · First pack purchase only"
                    : ""}
                  . Expires{" "}
                  {new Date(coupon.terms.expiresAt).toLocaleString("en-AU", {
                    timeZone: "Australia/Sydney",
                  })}{" "}
                  Sydney. Used only when purchase succeeds.
                </p>
              )}
            </form>
          )}
          {["PREMIUM", "STANDARD", "OTHER"].map((family) => {
            const products = sportProducts
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
                        {quoteFor(p) && (
                          <>
                            <s>{credits(p.price)}</s>{" "}
                          </>
                        )}
                        <strong>{credits(priceFor(p))}</strong> test credits
                      </p>
                      {coupon && (
                        <p className="small-note">
                          {quoteFor(p)
                            ? `${coupon.code} · Save ${credits(quoteFor(p)!.saving)} credits`
                            : "Coupon not eligible · regular price"}
                        </p>
                      )}
                      <button
                        className="pack-control primary"
                        aria-label={`Buy ${title(p)}`}
                        disabled={
                          busy ||
                          recovery ||
                          couponBusy ||
                          !p.available ||
                          s.wallet.spendable < priceFor(p)
                        }
                        onClick={() => {
                          setError("");
                          setReview(p);
                          setReviewCoupon(quoteFor(p));
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
                        <p className="small-note">
                          {p.availabilityReason ??
                            "This pack is currently unavailable."}
                        </p>
                      ) : (
                        s.wallet.spendable < priceFor(p) && (
                          <p className="small-note">
                            Insufficient available test credits
                          </p>
                        )
                      )}
                    </article>
                  ))}
                </div>
                <FamilyDisclosures p={products[0]} />
              </section>
            );
          })}
          {s.economyEnabled && (
            <p className="small-note">
              {sport === "nfl"
                ? "Core cards are exclusive to weekly starter packs."
                : "Core cards are free and are never included in paid packs."}
            </p>
          )}
          {sportProducts.some((p) => p.availabilityRetryable) && (
            <button
              className="pack-control secondary"
              disabled={busy || submitting}
              onClick={async () => {
                setSubmitting(true);
                setError("");
                try {
                  await refresh();
                } catch {
                  setError(
                    "Pack availability could not be refreshed. Please retry.",
                  );
                } finally {
                  setSubmitting(false);
                }
              }}
            >
              Retry availability
            </button>
          )}
          {!review && error && <p role="alert">{error}</p>}
        </div>
      )}
      {tab !== "buy" && (
        <section id="pack-history" className="pack-library">
          <h2>{tab === "mine" ? "My Packs" : "Pack history"}</h2>
          {sport === "nfl" && (
            <WeeklyCorePanel member={s.member} history={tab === "history"} />
          )}
          {sport === "nfl" && tab === "history" && (
            <StarterPackHistory member={s.member} />
          )}
          {(tab === "mine" ? unopened : historyPacks).length === 0 && (
            <p>
              {tab === "mine"
                ? sport === "nfl"
                  ? "No unopened purchased packs. Weekly rewards are shown above."
                  : "No unopened NBA test packs."
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
                {p.coupon && (
                  <p className="small-note">
                    {p.coupon.code} · Original {credits(p.coupon.original)} ·
                    Saved {credits(p.coupon.saving)} credits
                  </p>
                )}
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
                <dt>Pack price</dt>
                <dd>{credits(review.price)} test credits</dd>
              </div>
              {reviewCoupon && (
                <div>
                  <dt>{reviewCoupon.code} saving</dt>
                  <dd>−{credits(reviewCoupon.saving)} credits</dd>
                </div>
              )}
              <div>
                <dt>You pay</dt>
                <dd>
                  {credits(reviewCoupon?.charge ?? review.price)} test credits
                </dd>
              </div>
              <div>
                <dt>Available</dt>
                <dd>{credits(s.wallet.spendable)} test credits</dd>
              </div>
              <div>
                <dt>After purchase</dt>
                <dd>
                  {credits(
                    packBalance(
                      s.wallet.spendable,
                      reviewCoupon?.charge ?? review.price,
                    ),
                  )}{" "}
                  test credits
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
                  packBalance(
                    s.wallet.spendable,
                    reviewCoupon?.charge ?? review.price,
                  ) < 0
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

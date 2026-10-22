"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { boundedFetch } from "@/core/bounded-request";
import { sellerQuote } from "@/core/credits-policy";
import { cardIdentity } from "@/core/card-display";
import { rarityLabel } from "@/core/card-rarity";
import type { MarketplaceView } from "@/core/marketplace";
import { FantasySheet } from "./fantasy-sheet";
import { FantasyCardArtwork } from "./fantasy-card-artwork";
import type { ViewerCard } from "./collectible-viewer";

export const marketChanged = () => {
  // Let the submitting component leave its busy state before refreshing.
  window.setTimeout(() => {
    window.dispatchEvent(new Event("docked-market-changed"));
    window.dispatchEvent(new Event("docked-app-resume"));
  }, 0);
};
export function useMarketCommand(
  member: string,
  onSuccess: (
    result: Record<string, unknown>,
    command: Record<string, unknown>,
  ) => void,
) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [pending, setPending] = useState<{
      request: string;
      command: Record<string, unknown>;
    } | null>(null);
  const lock = useRef(false),
    alive = useRef(true),
    success = useRef(onSuccess);
  success.current = onSuccess;
  const key = `docked:market:pending:${member}`;
  useEffect(() => {
    alive.current = true;
    try {
      const value = localStorage.getItem(key);
      if (value) setPending(JSON.parse(value));
    } catch {
      setError(
        "Device storage is unavailable. Please enable it before selling or buying.",
      );
    }
    return () => {
      alive.current = false;
    };
  }, [key]);
  const send = async (command: Record<string, unknown>, retry = false) => {
    if (lock.current || (pending && !retry)) return;
    lock.current = true;
    setBusy(true);
    setError("");
    const envelope =
      retry && pending ? pending : { request: crypto.randomUUID(), command };
    try {
      localStorage.setItem(key, JSON.stringify(envelope));
      setPending(envelope);
      const r = await boundedFetch("/api/marketplace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(envelope),
      });
      const d = await r.json();
      if (!r.ok) {
        if (d.outcome === "rejected") {
          localStorage.removeItem(key);
          setPending(null);
          marketChanged();
        }
        throw Error(d.error || "Unable to confirm this request.");
      }
      if (d.state?.member !== member)
        throw Error("Account changed. Sign in again.");
      localStorage.removeItem(key);
      if (alive.current) {
        setPending(null);
        success.current(d.result, envelope.command);
      }
      marketChanged();
    } catch (e) {
      if (alive.current)
        setError(
          e instanceof Error
            ? e.message
            : "Connection interrupted. Check the original request.",
        );
    } finally {
      lock.current = false;
      if (alive.current) setBusy(false);
    }
  };
  return { busy, error, pending, send };
}
export function FeeBreakdown({ price }: { price: number }) {
  const q =
    Number.isSafeInteger(price) && price >= 1 && price <= 1_000_000_000
      ? sellerQuote(price)
      : null;
  return (
    <>
      <dl className="market-fees">
        <div>
          <dt>Sale price</dt>
          <dd>{q ? `${q.price.toLocaleString()} credits` : "—"}</dd>
        </div>
        <div>
          <dt>Seller fee · 5%</dt>
          <dd>{q ? `${q.fee.toLocaleString()} credits` : "—"}</dd>
        </div>
        <div>
          <dt>You receive</dt>
          <dd>{q ? `${q.net.toLocaleString()} credits` : "—"}</dd>
        </div>
      </dl>
      <p className="market-fee-note">
        No minimum fee · capped at 2,000 credits
      </p>
    </>
  );
}
export function MarketListingDialog({
  card,
  listing,
  onClose,
  onSaved,
}: {
  card: ViewerCard;
  listing?: MarketplaceView["rows"][number];
  onClose: () => void;
  onSaved?: () => void;
}) {
  const [state, setState] = useState<MarketplaceView | null>(null),
    [loadError, setLoadError] = useState(""),
    [price, setPrice] = useState(String(listing?.price ?? 1000)),
    [remove, setRemove] = useState(false),
    [receipt, setReceipt] = useState<Record<string, unknown> | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    void boundedFetch(
      `/api/marketplace?tab=listings&sell=${encodeURIComponent(card.id)}&sport=${card.sport ?? "nfl"}`,
      { cache: "no-store", signal: controller.signal },
    )
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw Error(d.error);
        if (!controller.signal.aborted) setState(d.state);
      })
      .catch((e) => {
        if (!controller.signal.aborted) setLoadError(e.message);
      });
    return () => controller.abort();
  }, [card.id, card.sport]);
  return (
    <FantasySheet
      title={listing ? "Manage listing" : "Confirm listing"}
      className="market-listing-sheet"
      historyEntry
      onClose={onClose}
    >
      {!state ? (
        <p role={loadError ? "alert" : "status"}>
          {loadError || "Checking card…"}
        </p>
      ) : (
        <ListingForm
          key={state.member}
          member={state.member}
          card={card}
          listing={listing}
          own={state.inventory.find((c) => c.id === card.id)}
          trading={state.tradingEnabled}
          offers={state.offersEnabled}
          price={price}
          setPrice={setPrice}
          remove={remove}
          setRemove={setRemove}
          receipt={receipt}
          setReceipt={setReceipt}
          onSaved={onSaved}
          onClose={onClose}
        />
      )}
    </FantasySheet>
  );
}
function ListingForm({
  member,
  card,
  listing,
  own,
  trading,
  offers,
  price,
  setPrice,
  remove,
  setRemove,
  receipt,
  setReceipt,
  onSaved,
  onClose,
}: {
  member: string;
  card: ViewerCard;
  listing?: MarketplaceView["rows"][number];
  own: MarketplaceView["inventory"][number] | undefined;
  trading: boolean;
  offers: boolean;
  price: string;
  setPrice: (s: string) => void;
  remove: boolean;
  setRemove: (v: boolean) => void;
  receipt: Record<string, unknown> | null;
  setReceipt: (v: Record<string, unknown>) => void;
  onSaved?: () => void;
  onClose: () => void;
}) {
  const [acceptSwaps, setAcceptSwaps] = useState(false);
  const { busy, error, pending, send } = useMarketCommand(member, (r, c) => {
    setReceipt({
      ...r,
      confirmedKind: c.kind,
      matchesCard:
        c.card === card.id || (!!listing && c.listing === listing.id),
    });
    onSaved?.();
  });
  const value = /^\d+$/.test(price) ? Number(price) : NaN,
    valid = Number.isSafeInteger(value) && value >= 1 && value <= 1_000_000_000;
  const restriction = !own
    ? "Only the current owner can sell this card."
    : !listing && own.listed
      ? "This card is already listed."
      : own.transferReason ||
        (!trading ? "Card sales are temporarily unavailable." : "");
  if (receipt)
    return (
      <div className="market-confirmed" role="status">
        <h3>
          {!receipt.matchesCard
            ? "Original request confirmed"
            : receipt.status === "CANCELLED"
              ? "Listing removed"
              : receipt.confirmedKind === "reprice-listing"
                ? "Price saved"
                : "Card listed"}
        </h3>
        {!!receipt.matchesCard && <p>{card.name}</p>}
        <div className="actions">
          {!!receipt.listing && receipt.status !== "CANCELLED" && (
            <Link
              className="button primary"
              href={`/fantasy/market?listing=${encodeURIComponent(String(receipt.listing))}&sport=${card.sport ?? "nfl"}`}
            >
              View listing
            </Link>
          )}
          <Link className="button" href="/fantasy/market?tab=listings">
            My Listings
          </Link>
          <button className="button" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    );
  return (
    <>
      <p>Sell for Docked Credits</p>
      <div className={listing ? "market-manage-card" : "market-confirm-card"}>
        <div className="market-listing-artwork">
          <FantasyCardArtwork card={card} faceOnly />
        </div>
        <div>
          <strong>{card.name}</strong>
          <p>
            {rarityLabel(card.tier)} · {cardIdentity(card)}
          </p>
        </div>
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (valid && !restriction)
            void send(
              listing
                ? {
                    kind: "reprice-listing",
                    listing: listing.id,
                    price: value,
                    expectedRevision: listing.revision,
                  }
                : {
                    kind: "list",
                    card: card.id,
                    price: value,
                    preference: offers && acceptSwaps ? "both" : "sell",
                  },
            );
        }}
      >
        <label htmlFor="market-asking">
          {listing ? "New asking price" : "Your asking price"}
        </label>
        <div className="market-price-input">
          <input
            id="market-asking"
            inputMode="numeric"
            pattern="[0-9]+"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            disabled={busy || !!pending}
            required
          />
          <span>credits</span>
        </div>
        {!valid && (
          <p role="alert">
            Enter a whole-credit price from 1 to 1,000,000,000.
          </p>
        )}
        <FeeBreakdown price={value} />
        {offers && !listing && (
          <label>
            <input
              type="checkbox"
              checked={acceptSwaps}
              onChange={(e) => setAcceptSwaps(e.target.checked)}
              disabled={busy || !!pending}
            />{" "}
            Also accept offers with cards from this test sport
          </label>
        )}
        {restriction && <p role="alert">{restriction}</p>}
        {error && <p role="alert">{error}</p>}
        {pending && !busy ? (
          <button
            type="button"
            className="button"
            onClick={() => void send(pending.command, true)}
          >
            Check original request
          </button>
        ) : (
          <div className="actions">
            <button
              type="button"
              className="button"
              onClick={onClose}
              disabled={busy}
            >
              Cancel
            </button>
            <button
              className="button primary"
              disabled={busy || !valid || !!restriction}
            >
              {busy ? "Confirming…" : listing ? "Save price" : "List card"}
            </button>
          </div>
        )}
      </form>
      {listing && (
        <div className="market-remove">
          {remove ? (
            <>
              <p>Remove this listing from the marketplace?</p>
              <button
                className="button danger"
                disabled={busy || !!pending}
                onClick={() =>
                  void send({
                    kind: "cancel-listing",
                    listing: listing.id,
                    expectedRevision: listing.revision,
                  })
                }
              >
                Confirm removal
              </button>
              <button
                className="button"
                onClick={() => setRemove(false)}
                disabled={busy}
              >
                Keep listing
              </button>
            </>
          ) : (
            <button
              className="button danger"
              onClick={() => setRemove(true)}
              disabled={busy || !!pending}
            >
              Remove listing
            </button>
          )}
        </div>
      )}
    </>
  );
}

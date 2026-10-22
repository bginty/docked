"use client";
import { useEffect, useRef, useState } from "react";
import type { privateOffers } from "@/server/private-card-offers";
import { FantasyCardArtwork } from "./fantasy-card-artwork";
import Link from "next/link";
import { FantasySheet } from "./fantasy-player-sheet";
import { boundedFetch } from "@/core/bounded-request";
import { combinedOfferQuote, sellerQuote } from "@/core/credits-policy";

type Pending = { request: string; command: Record<string, unknown> };
/** The same command is retained after uncertain transport, including a refresh. */
function useOfferMutation(member: string) {
  const [pending, setPending] = useState<Pending | null>(null),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const active = useRef(false);
  const key = `docked:private-offer:v1:${member}`;
  useEffect(() => {
    setPending(null);
    setMessage("");
    try {
      const p = JSON.parse(sessionStorage.getItem(key) ?? "null");
      if (p?.request && p?.command) setPending(p);
    } catch {
      setMessage(
        "Offer recovery storage is unavailable. Check your offers before retrying.",
      );
    }
  }, [key]);
  async function send(command: Record<string, unknown>) {
    if (active.current) return;
    active.current = true;
    setBusy(true);
    try {
      const retained = JSON.parse(
        sessionStorage.getItem(key) ?? "null",
      ) as Pending | null;
      const operation = retained ?? { request: crypto.randomUUID(), command };
      setPending(operation);
      sessionStorage.setItem(key, JSON.stringify(operation));
      const r = await boundedFetch("/api/community", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "card_offer", ...operation }),
      });
      const data = await r.json();
      if (!r.ok) {
        if (r.status === 403) {
          sessionStorage.removeItem(key);
          setPending(null);
        }
        throw Error(
          data.error ??
            "Offer outcome is uncertain. Retry the original request.",
        );
      }
      sessionStorage.removeItem(key);
      setPending(null);
      setMessage("Offer updated.");
      window.dispatchEvent(new Event("docked:offers-updated"));
      return true;
    } catch (e) {
      setMessage(
        e instanceof Error
          ? e.message
          : "Outcome not confirmed. Retry this request.",
      );
      return false;
    } finally {
      active.current = false;
      setBusy(false);
    }
  }
  return { send, pending, busy, message };
}
type OffersView = Awaited<ReturnType<typeof privateOffers>>;
export function MakeCardOffer({
  card,
  member,
  enabled,
  listing,
  preference = "both",
}: {
  card: string;
  member: string;
  enabled: boolean;
  listing?: string;
  preference?: "sell" | "swap" | "both";
}) {
  const [cardQuery, setCardQuery] = useState(""),
    [cardPage, setCardPage] = useState(0);
  const [open, setOpen] = useState(false),
    [amount, setAmount] = useState(""),
    [offered, setOffered] = useState(""),
    [review, setReview] = useState(false);
  const [data, setData] = useState<OffersView | null>(null),
    [error, setError] = useState("");
  const { send, pending, busy, message } = useOfferMutation(member);
  useEffect(() => {
    if (!open || !enabled) return;
    const controller = new AbortController();
    setData(null);
    const timer = setTimeout(
      () =>
        boundedFetch(
          `/api/community?view=offers&q=${encodeURIComponent(cardQuery)}&inventoryPage=${cardPage}&targetCard=${encodeURIComponent(card)}`,
          {
            cache: "no-store",
            signal: controller.signal,
          },
        )
          .then(async (r) => {
            if (!r.ok)
              throw Error(
                "Your eligible cards could not be loaded. Close and retry.",
              );
            const v = await r.json();
            if (!controller.signal.aborted) setData(v);
          })
          .catch((e) => {
            if (!controller.signal.aborted) setError(e.message);
          }),
      200,
    );
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [open, enabled, cardQuery, cardPage, card]);
  const price = Number(amount || 0),
    combinedBlocked = !!offered && price > 0 && !data?.combinedEnabled;
  let feeError = "";
  let quote: { fee: number; net: number } | null = null;
  if (price > 0 && Number.isSafeInteger(price) && price <= 1000000000) {
    try {
      quote = offered
        ? combinedOfferQuote(price, data?.swapFee ?? 0)
        : sellerQuote(price);
    } catch (e) {
      feeError = e instanceof Error ? e.message : "Invalid amount";
    }
  }
  const invalid =
    !Number.isSafeInteger(price) ||
    price < 0 ||
    price > 1000000000 ||
    (!offered && price === 0) ||
    (preference === "swap" && !offered) ||
    combinedBlocked ||
    !!feeError ||
    !data?.enabled;
  return (
    <>
      <button
        disabled={!enabled}
        onClick={() => {
          setOpen(true);
          setError("");
        }}
      >
        Make offer
      </button>
      {!enabled && <small>Offers are temporarily unavailable.</small>}
      {open && (
        <FantasySheet title="Make an offer" onClose={() => setOpen(false)}>
          <p>
            Offer credits, one eligible card, or both. Nothing transfers until
            the seller accepts this exact offer.
          </p>
          {error && <p role="alert">{error}</p>}
          {feeError && <p role="alert">{feeError}</p>}
          {quote && (
            <p>
              Seller fee {quote.fee.toLocaleString()} credits · Seller receives{" "}
              {quote.net.toLocaleString()} credits
              {offered
                ? " plus your card. Combined fees use the current sale commission with the applicable swap-fee minimum."
                : "."}
            </p>
          )}
          {offered && price === 0 && data && (
            <p>
              Card swap fee: {data.swapFee} credits per member, rechecked on
              acceptance.
            </p>
          )}
          {preference !== "sell" && (
            <div>
              <label>
                Search your cards
                <input
                  type="search"
                  value={cardQuery}
                  disabled={busy || !!pending}
                  onChange={(e) => {
                    setCardQuery(e.target.value);
                    setCardPage(0);
                    setOffered("");
                    setReview(false);
                  }}
                />
              </label>
              <label>
                Your offered card
                <select
                  disabled={busy || !!pending}
                  value={offered}
                  onChange={(e) => {
                    setOffered(e.target.value);
                    setReview(false);
                  }}
                >
                  <option value="">Credits only</option>
                  {data?.inventory
                    .filter((c) => c.id !== card)
                    .map((c) => (
                      <option
                        key={c.id}
                        value={c.id}
                        disabled={!!c.transferReason || c.listed}
                      >
                        {c.name} · {c.tier} #{c.serial}
                        {c.transferReason || c.listed ? " · unavailable" : ""}
                      </option>
                    ))}
                </select>
              </label>
              {data && data.inventoryTotal > 40 && (
                <nav className="actions" aria-label="Offered-card pages">
                  <button
                    disabled={cardPage === 0 || busy || !!pending}
                    onClick={() => {
                      setCardPage((p) => p - 1);
                      setOffered("");
                    }}
                  >
                    Previous cards
                  </button>
                  <span>Page {cardPage + 1}</span>
                  <button
                    disabled={
                      (cardPage + 1) * 40 >= data.inventoryTotal ||
                      busy ||
                      !!pending
                    }
                    onClick={() => {
                      setCardPage((p) => p + 1);
                      setOffered("");
                    }}
                  >
                    More cards
                  </button>
                </nav>
              )}
            </div>
          )}
          {data?.inventory
            .filter((c) => c.id === offered)
            .map((c) => (
              <div className="offer-card-preview" key={c.id}>
                <FantasyCardArtwork card={c} faceOnly />
              </div>
            ))}
          <label>
            Credits offered
            <input
              type="number"
              min={0}
              max={1000000000}
              step={1}
              value={amount}
              disabled={busy || !!pending}
              onChange={(e) => {
                setAmount(e.target.value);
                setReview(false);
              }}
            />
          </label>
          {combinedBlocked && (
            <p role="status">
              Card-plus-credit offers are temporarily unavailable.
            </p>
          )}
          <p className="form-help">
            Expires in seven days. Cards and credits are rechecked on
            acceptance, not reserved by this proposal. Test credits have no cash
            value.
          </p>
          {review && (
            <p>
              Submit {offered ? "the selected card plus " : ""}
              {price.toLocaleString()} credits? The card has no guaranteed
              credit value.
            </p>
          )}
          <button
            className="button"
            disabled={busy || (!pending && invalid)}
            onClick={() => {
              if (!review && !pending) {
                setReview(true);
                return;
              }
              void send({
                kind: "private-offer",
                card,
                price,
                ...(offered ? { offeredCards: [offered] } : {}),
                ...(listing ? { listing } : {}),
              }).then((ok) => {
                if (ok) {
                  setOpen(false);
                  setAmount("");
                  setOffered("");
                  setReview(false);
                }
              });
            }}
          >
            {busy
              ? "Checking…"
              : pending
                ? "Recover original offer"
                : review
                  ? "Submit offer"
                  : "Review offer"}
          </button>
          <p role="status">{message}</p>
          <button disabled={busy} onClick={() => setOpen(false)}>
            Cancel
          </button>
        </FantasySheet>
      )}
      {!open && <p role="status">{message}</p>}
    </>
  );
}
export function PrivateOffersInbox({
  member,
  sport,
}: {
  member: string;
  sport?: string;
}) {
  const [data, setData] = useState<Awaited<
      ReturnType<typeof privateOffers>
    > | null>(null),
    [error, setError] = useState(""),
    [review, setReview] = useState<{ offer: string; kind: string } | null>(
      null,
    );
  const { send, pending, busy, message } = useOfferMutation(member);
  useEffect(() => {
    let controller = new AbortController();
    setData(null);
    async function load() {
      controller.abort();
      controller = new AbortController();
      const current = controller;
      try {
        const r = await boundedFetch("/api/community?view=offers", {
          cache: "no-store",
          signal: current.signal,
        });
        if (!r.ok) throw Error("Offers could not be loaded");
        const v = await r.json();
        if (!current.signal.aborted) {
          setData(v);
          setError("");
        }
      } catch (e) {
        if (!current.signal.aborted) {
          setError(e instanceof Error ? e.message : "Unavailable");
        }
      }
    }
    void load();
    window.addEventListener("docked:offers-updated", load);
    return () => {
      controller.abort();
      window.removeEventListener("docked:offers-updated", load);
    };
  }, [member]);
  const offers =
    data?.offers.filter((o) => !sport || o.card.sport === sport) ?? [];
  return (
    <section className="social-offers">
      <h2>Offers received & sent</h2>
      {error && <p role="alert">{error}</p>}
      {!data && !error && <p>Loading offers…</p>}
      {data && !data.enabled && (
        <p>
          Trading is temporarily unavailable. You can still cancel or decline
          existing offers.
        </p>
      )}
      {data?.enabled && offers.length === 0 && <p>No offers yet.</p>}
      {pending && (
        <button disabled={busy} onClick={() => send(pending.command)}>
          Recover original request
        </button>
      )}
      {offers.map((o) => (
        <article key={o.id} className="app-panel">
          <div className="market-offer-cards">
            <div className="social-offer-card">
              <small>Requested card</small>
              <FantasyCardArtwork card={o.card} faceOnly />
            </div>
            {o.offeredCards?.map((c) => (
              <div className="social-offer-card" key={c.id}>
                <small>Offered card</small>
                <FantasyCardArtwork card={c} faceOnly />
              </div>
            ))}
          </div>
          <h3>
            {o.side === "received" ? "From" : "To"} {o.counterparty} ·{" "}
            {o.price.toLocaleString()} test credits
          </h3>
          <p>
            {o.status === "ACCEPTED"
              ? "Completed · accepted and settled"
              : o.status === "OPEN"
                ? "Pending"
                : o.status.toLowerCase()}{" "}
            · {o.status === "OPEN" ? "Expires" : "Offer expiry"}{" "}
            {new Date(o.expires).toLocaleString("en-AU")}
          </p>
          {o.side === "received" && (
            <p>
              Swap fee each: {o.feeEach.toLocaleString()} · Credit commission{" "}
              {o.fee.toLocaleString()} · You receive {o.net.toLocaleString()}{" "}
              test credits
            </p>
          )}
          {o.status === "OPEN" && !pending && (
            <div className="actions">
              {(o.side === "received"
                ? ["private-accept", "private-decline"]
                : ["private-cancel"]
              ).map((kind) => (
                <button
                  key={kind}
                  className="button ghost"
                  disabled={
                    busy || (kind === "private-accept" && !data?.enabled)
                  }
                  onClick={() => setReview({ offer: o.id, kind })}
                >
                  {kind === "private-accept"
                    ? "Review acceptance"
                    : kind === "private-decline"
                      ? "Decline"
                      : "Cancel offer"}
                </button>
              ))}
            </div>
          )}
          {review?.offer === o.id && (
            <div className="social-settings">
              <p>
                {review.kind === "private-accept"
                  ? `Transfer this exact card for ${o.offeredCards?.length ? "the displayed offered card plus " : ""}${o.price.toLocaleString()} test credits? Swap fee each ${o.feeEach}. Seller credit proceeds ${o.net.toLocaleString()}, commission ${o.fee.toLocaleString()}. Both members’ eligibility and the buyer’s credits will be checked again.`
                  : "Confirm this offer update?"}
              </p>
              <div className="actions">
                <button
                  className="button"
                  disabled={
                    busy || (review.kind === "private-accept" && !data?.enabled)
                  }
                  onClick={() =>
                    send({ kind: review.kind, offer: o.id }).then((ok) => {
                      if (ok) setReview(null);
                    })
                  }
                >
                  Confirm
                </button>
                <button disabled={busy} onClick={() => setReview(null)}>
                  Back
                </button>
              </div>
            </div>
          )}
          {o.listing && (
            <Link
              href={`/fantasy/market?tab=activity&listing=${encodeURIComponent(o.listing)}`}
            >
              View private receipt →
            </Link>
          )}
        </article>
      ))}
      <p role="status">{message}</p>
    </section>
  );
}

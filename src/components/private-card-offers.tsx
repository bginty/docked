"use client";
import { useEffect, useRef, useState } from "react";
import type { privateOffers } from "@/server/private-card-offers";
import { FantasyCardArtwork } from "./fantasy-card-artwork";
import Link from "next/link";

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
      const r = await fetch("/api/community", {
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
export function MakeCardOffer({
  card,
  member,
  enabled,
}: {
  card: string;
  member: string;
  enabled: boolean;
}) {
  const [amount, setAmount] = useState(""),
    [review, setReview] = useState(false);
  const { send, pending, busy, message } = useOfferMutation(member);
  return (
    <details>
      <summary>Make an offer</summary>
      {!enabled ? (
        <p>Private offers await beta trading approval.</p>
      ) : (
        <>
          <label>
            Test Docked Credits
            <input
              type="number"
              min={1}
              max={1000000000}
              step={1}
              value={amount}
              disabled={!!pending || busy}
              onChange={(e) => {
                setAmount(e.target.value);
                setReview(false);
              }}
            />
          </label>
          <p className="form-help">
            Expires in seven days. Credits are checked on acceptance; an offer
            is not a guaranteed payment. Test credits have no cash value.
          </p>
          {review && (
            <p>
              Offer {Number(amount).toLocaleString()} test credits for this
              exact card?
            </p>
          )}
          <button
            className="button"
            disabled={
              busy ||
              (!pending &&
                (!Number.isSafeInteger(Number(amount)) || Number(amount) <= 0))
            }
            onClick={() => {
              if (!review && !pending) {
                setReview(true);
                return;
              }
              void send({
                kind: "private-offer",
                card,
                price: Number(amount),
              }).then((ok) => {
                if (ok) {
                  setReview(false);
                  setAmount("");
                }
              });
            }}
          >
            {busy
              ? "Checking…"
              : pending
                ? "Recover original offer"
                : review
                  ? "Confirm offer"
                  : "Review offer"}
          </button>
          <p role="status">{message}</p>
        </>
      )}
    </details>
  );
}
export function PrivateOffersInbox({ member }: { member: string }) {
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
    async function load() {
      controller.abort();
      controller = new AbortController();
      const current = controller;
      try {
        const r = await fetch("/api/community?view=offers", {
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
          setData(null);
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
  return (
    <section className="social-offers">
      <h2>Private offers</h2>
      {error && <p role="alert">{error}</p>}
      {!data && !error && <p>Loading offers…</p>}
      {data && !data.enabled && (
        <p>
          Private offers await beta trading approval. No hosted settlement is
          enabled.
        </p>
      )}
      {data?.enabled && data.offers.length === 0 && <p>No offers yet.</p>}
      {pending && (
        <button disabled={busy} onClick={() => send(pending.command)}>
          Recover original request
        </button>
      )}
      {data?.offers.map((o) => (
        <article key={o.id} className="app-panel">
          <div className="social-offer-card">
            <FantasyCardArtwork card={o.card} faceOnly />
          </div>
          <h3>
            {o.side === "received" ? "Received offer" : "Your offer"} ·{" "}
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
              Commission {o.fee.toLocaleString()} · You receive{" "}
              {o.net.toLocaleString()} test credits
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
                  disabled={busy}
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
                  ? `Transfer this exact card for ${o.price.toLocaleString()} test credits? Seller proceeds ${o.net.toLocaleString()}, commission ${o.fee.toLocaleString()}. Both members’ eligibility and the buyer’s credits will be checked again.`
                  : "Confirm this offer update?"}
              </p>
              <div className="actions">
                <button
                  className="button"
                  disabled={busy}
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

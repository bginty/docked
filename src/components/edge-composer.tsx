"use client";
import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import type {
  CommunityReview,
  QuoteOptionsResponse,
} from "@/core/community-edge";
import { permanentEdgeStatement } from "@/core/community-edge";
import { AppIcon } from "./app-icon";
import { ApprovedEdgeMedia } from "./approved-edge-media";
import { lightNativeFeedback } from "./native-share";
const initial: QuoteOptionsResponse = {
  status: "NO_VERIFIED_PRICES",
  message: "Loading the current independent market reference…",
  options: [],
};
export function EdgeComposer({
  onSocial,
}: {
  onSocial: (reasoning: string) => void;
}) {
  const [data, setData] = useState(initial),
    [selection, setSelection] = useState(""),
    [sport, setSport] = useState(""),
    [competition, setCompetition] = useState(""),
    [event, setEvent] = useState(""),
    [market, setMarket] = useState(""),
    [outcome, setOutcome] = useState("");
  const [review, setReview] = useState<CommunityReview | null>(null),
    [reasoning, setReasoning] = useState(""),
    [confirmed, setConfirmed] = useState(false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [moved, setMoved] = useState<string | null>(null),
    [idempotencyKey, setKey] = useState(""),
    [submitted, setSubmitted] = useState<string | null>(null),
    [mediaIds, setMediaIds] = useState<string[]>([]),
    [personalBookmaker, setPersonalBookmaker] = useState(""),
    [personalPrice, setPersonalPrice] = useState(""),
    [personalPromotional, setPersonalPromotional] = useState(false);
  const selected =
    data.options.find(
      (q) =>
        q.pricingModel === "market_reference_v1" &&
        q.eventId === event &&
        q.marketId === market &&
        q.selection === outcome,
    ) ??
    data.options.find((q) => `${q.snapshotId}:${q.selection}` === selection);
  const displayedReference =
    review?.pricingModel === "market_reference_v1" &&
    review.marketId === selected?.marketId &&
    review.selection === selected?.selection
      ? review
      : selected;
  async function load() {
    setBusy(true);
    try {
      const r = await fetch("/api/community-edges?view=options", {
        cache: "no-store",
      });
      const value = await r.json();
      if (!r.ok) throw new Error(value.error ?? "Prices are unavailable.");
      setData(value);
      setReview(null);
      setConfirmed(false);
      setSelection("");
    } catch {
      setData({
        status: "NOT_CONFIGURED",
        message:
          "Current verified prices are unavailable. No competitive record can be submitted.",
        options: [],
      });
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    let live = true;
    void fetch("/api/community-edges?view=options", { cache: "no-store" })
      .then(async (r) => {
        const v = await r.json();
        if (live)
          setData(
            r.ok
              ? v
              : {
                  status: "NOT_CONFIGURED",
                  message: v.error ?? "Verified prices are unavailable.",
                  options: [],
                },
          );
      })
      .catch(() => {
        if (live)
          setData({
            status: "NOT_CONFIGURED",
            message:
              "Provider prices could not be loaded. No record has been submitted.",
            options: [],
          });
      });
    return () => {
      live = false;
    };
  }, []);
  function resetReview() {
    setReview(null);
    setConfirmed(false);
    setMoved(null);
    setMessage("");
  }
  const unique = (values: string[]) => [...new Set(values)];
  const sports = unique(data.options.map((q) => q.sport));
  const competitions = unique(
    data.options.filter((q) => q.sport === sport).map((q) => q.competition),
  );
  const events = data.options
    .filter((q) => q.sport === sport && q.competition === competition)
    .filter((q, i, a) => a.findIndex((v) => v.eventId === q.eventId) === i);
  const markets = unique(
    data.options.filter((q) => q.eventId === event).map((q) => q.marketId),
  );
  const selections = unique(
    data.options
      .filter((q) => q.eventId === event && q.marketId === market)
      .map((q) => q.selection),
  );
  const books = data.options.filter(
    (q) =>
      q.eventId === event && q.marketId === market && q.selection === outcome,
  );
  async function inspect(e: FormEvent) {
    e.preventDefault();
    if (!selected) return;
    setBusy(true);
    setMessage("");
    try {
      const r = await fetch("/api/community-edges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "review",
          ...(selected.pricingModel === "market_reference_v1"
            ? { marketId: selected.marketId }
            : { snapshotId: selected.snapshotId }),
          selection: selected.selection,
        }),
      });
      const value = await r.json();
      if (!r.ok)
        throw new Error(
          value.error ??
            value.message ??
            "Price review failed. Refresh the available prices.",
        );
      setReview(value.review);
      setKey(crypto.randomUUID());
      setConfirmed(false);
      setMoved(null);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Review unavailable.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!review || !confirmed) return;
    setBusy(true);
    setMessage("");
    try {
      const r = await fetch("/api/community-edges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "submit",
          ...(review.pricingModel === "market_reference_v1"
            ? { marketId: review.marketId }
            : { snapshotId: review.snapshotId }),
          selection: review.selection,
          reviewToken: review.reviewToken,
          confirmedPermanent: true,
          idempotencyKey,
          reasoning: reasoning.trim() || undefined,
          mediaIds,
          ...(review.pricingModel === "market_reference_v1"
            ? {
                personalBookmaker: personalBookmaker.trim() || undefined,
                personalPrice: personalPrice.trim() || undefined,
                personalPromotional,
              }
            : {}),
        }),
      });
      const value = await r.json();
      if (value.code === "PRICE_MOVED" && value.current) {
        setMoved(
          `${value.previousOdds ?? review.odds} → ${value.current.odds}`,
        );
        setReview(value.current);
        setConfirmed(false);
        setKey(crypto.randomUUID());
        return;
      }
      if (!r.ok)
        throw new Error(
          value.error ?? value.message ?? "Submission was not confirmed.",
        );
      setSubmitted(value.edge?.id ?? value.id ?? null);
      void lightNativeFeedback();
      setMessage(
        "Your permanent community Edge has been recorded. Settlement remains pending until an authorised result is available.",
      );
      setReview(null);
      setConfirmed(false);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Submission was not confirmed. Keep this page open and retry; the request uses the same idempotency key.",
      );
    } finally {
      setBusy(false);
    }
  }
  if (submitted)
    return (
      <div className="app-panel">
        <AppIcon name="shield" size={34} />
        <h2>Permanent record submitted.</h2>
        <p role="status">{message}</p>
        <Link className="button" href={`/community/edges/${submitted}`}>
          View your record
        </Link>
      </div>
    );
  return (
    <div>
      <div className="app-state-banner">
        <strong>1.00 standard unit · Pre-event only</strong>
        <p>
          No cash stake is requested. A screenshot cannot verify odds or settle
          a record.
        </p>
      </div>
      {data.status !== "READY" ? (
        <div className="app-empty">
          <h2>
            {data.status === "RESTRICTED"
              ? "Edge submissions are restricted"
              : "No verified prices available"}
          </h2>
          <p>{data.message}</p>
          <p className="small-note">{data.status}</p>
          <button className="button ghost" onClick={load} disabled={busy}>
            Refresh verified prices
          </button>
        </div>
      ) : (
        <form className="app-form" onSubmit={inspect}>
          <div className="form-split">
            <label>
              Sport
              <select
                required
                value={sport}
                onChange={(e) => {
                  setSport(e.target.value);
                  setCompetition("");
                  setEvent("");
                  setMarket("");
                  setOutcome("");
                  setSelection("");
                  resetReview();
                }}
              >
                <option value="">Choose sport</option>
                {sports.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
            <label>
              Competition
              <select
                required
                disabled={!sport}
                value={competition}
                onChange={(e) => {
                  setCompetition(e.target.value);
                  setEvent("");
                  setMarket("");
                  setOutcome("");
                  setSelection("");
                  resetReview();
                }}
              >
                <option value="">Choose competition</option>
                {competitions.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
          </div>
          <label>
            Event
            <select
              required
              disabled={!competition}
              value={event}
              onChange={(e) => {
                setEvent(e.target.value);
                setMarket("");
                setOutcome("");
                setSelection("");
                resetReview();
              }}
            >
              <option value="">Choose event</option>
              {events.map((q) => (
                <option key={q.eventId} value={q.eventId}>
                  {q.eventLabel} · {new Date(q.startAt).toLocaleString()}
                </option>
              ))}
            </select>
          </label>
          <div className="form-split">
            <label>
              Market
              <select
                required
                disabled={!event}
                value={market}
                onChange={(e) => {
                  setMarket(e.target.value);
                  setOutcome("");
                  setSelection("");
                  resetReview();
                }}
              >
                <option value="">Choose market</option>
                {markets.map((s) => (
                  <option key={s} value={s}>
                    {data.options.find(
                      (q) => q.eventId === event && q.marketId === s,
                    )?.marketLabel ?? s}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Selection
              <select
                required
                disabled={!market}
                value={outcome}
                onChange={(e) => {
                  setOutcome(e.target.value);
                  setSelection("");
                  resetReview();
                }}
              >
                <option value="">Choose selection</option>
                {selections.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
          </div>
          {books.some((q) => q.pricingModel !== "market_reference_v1") && (
            <label>
              Bookmaker · provider-observed standard odds
              <select
                required
                disabled={!outcome}
                value={selection}
                onChange={(e) => {
                  setSelection(e.target.value);
                  resetReview();
                }}
              >
                <option value="">Choose verified price</option>
                {books.map((q) => (
                  <option
                    key={`${q.snapshotId}:${q.selection}`}
                    value={`${q.snapshotId}:${q.selection}`}
                  >
                    {q.bookmaker} · {q.odds}
                  </option>
                ))}
              </select>
            </label>
          )}
          {selected?.pricingModel === "market_reference_v1" && (
            <div className="reference-preview">
              <strong>CURRENT MARKET {displayedReference?.odds}</strong>
              <p>
                Server-calculated standard market reference. You cannot type or
                choose the competitive price. It will be checked again at
                submission.
              </p>
              <p className="small-note">
                Methodology{" "}
                {displayedReference?.marketReference?.methodologyVersion ??
                  displayedReference?.ruleVersion}{" "}
                · UNVALIDATED
              </p>
            </div>
          )}
          <label>
            Reasoning (optional)
            <textarea
              maxLength={2000}
              value={reasoning}
              onChange={(e) => setReasoning(e.target.value)}
              placeholder="Explain the sporting context and uncertainty."
            />
          </label>
          <details className="app-panel social-price-context">
            <summary>Optional personal price — social context only</summary>
            <p>
              Your own bookmaker or price does not change the permanent
              benchmark, settlement, ROI, or Top Docked ranking. Promotions
              remain clearly labelled.
            </p>
            <label>
              Personal bookmaker (optional)
              <input
                maxLength={100}
                value={personalBookmaker}
                onChange={(e) => setPersonalBookmaker(e.target.value)}
              />
            </label>
            <label>
              Personal decimal price (optional)
              <input
                type="number"
                min="1.01"
                max="1000"
                step="0.01"
                inputMode="decimal"
                value={personalPrice}
                onChange={(e) => setPersonalPrice(e.target.value)}
              />
            </label>
            <label className="check">
              <input
                type="checkbox"
                checked={personalPromotional}
                onChange={(e) => setPersonalPromotional(e.target.checked)}
              />
              This personal price is a boost or promotion.
            </label>
          </details>
          <button className="button" disabled={!selected || busy}>
            Review verified Edge
          </button>
        </form>
      )}
      {data.status === "READY" && (
        <ApprovedEdgeMedia
          selected={mediaIds}
          onChange={setMediaIds}
          disabled={busy}
        />
      )}
      {review && (
        <form className="app-form compose-review" onSubmit={submit}>
          <h2>Integrity review</h2>
          {moved && (
            <div className="price-moved" role="alert">
              <strong>Price moved: {moved}</strong>
              <p>
                Review the current provider price and confirm again. Your
                previous confirmation has been cleared.
              </p>
            </div>
          )}
          <h3>{review.eventLabel}</h3>
          <p>
            {review.selection} · {review.marketLabel ?? review.marketId} ·{" "}
            {review.pricingModel === "market_reference_v1"
              ? "Independent market reference"
              : review.bookmaker}
          </p>
          <dl className="edge-facts">
            <div>
              <dt>
                {review.pricingModel === "market_reference_v1"
                  ? "Submission market reference"
                  : "Verified odds"}
              </dt>
              <dd>{review.odds}</dd>
            </div>
            <div>
              <dt>Benchmark</dt>
              <dd>1.00 unit</dd>
            </div>
            <div>
              <dt>Source time</dt>
              <dd>{new Date(review.sourceAt).toLocaleString()}</dd>
            </div>
            <div>
              <dt>Received</dt>
              <dd>{new Date(review.receivedAt).toLocaleString()}</dd>
            </div>
            <div>
              <dt>Submissions close</dt>
              <dd>{new Date(review.cutoffAt).toLocaleString()}</dd>
            </div>
            <div>
              <dt>Classification</dt>
              <dd>{review.classification.replaceAll("_", " ")}</dd>
            </div>
          </dl>
          {review.pricingModel === "market_reference_v1" && (
            <p className="form-help">
              Methodology UNVALIDATED. Your competitive benchmark is{" "}
              {review.odds}; personal prices and images never change this
              record. Source count:{" "}
              {review.marketReference?.sourceCount ?? "Unavailable"}.
            </p>
          )}
          <p className="permanent-notice">{permanentEdgeStatement}</p>
          <label className="check">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              required
            />
            <span>I understand and accept this permanent record.</span>
          </label>
          <p className="form-help">
            Final submission rechecks the price, source age, event cutoff and
            eligibility using server time. Availability is not guaranteed
            execution.
          </p>
          <button className="button" disabled={!confirmed || busy}>
            {busy
              ? "Checking and submitting…"
              : review.pricingModel === "market_reference_v1"
                ? "Submit at market reference"
                : "Submit at verified price"}
          </button>
        </form>
      )}
      <p role="status" className="form-message">
        {message}
      </p>
      <div className="integrity-note">
        <AppIcon name="shield" />
        <div>
          <strong>Different price or unsupported market?</strong>
          <p>
            Boosts, personalised offers, screenshots and unverified prices
            belong in social discussion. They never count towards Top Docked or
            verified performance.
          </p>
          <button className="button ghost" onClick={() => onSocial(reasoning)}>
            Post as social content only
          </button>
        </div>
      </div>
    </div>
  );
}

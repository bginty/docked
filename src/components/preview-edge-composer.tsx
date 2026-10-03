"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  previewPermanentStatement,
  previewPriceLabel,
  type PreviewFixtureResponse,
  type PreviewReview,
} from "@/core/preview-market-contracts";

export function PreviewEdgeComposer() {
  const [data, setData] = useState<PreviewFixtureResponse | null>(null);
  const [sport, setSport] = useState(""),
    [event, setEvent] = useState(""),
    [market, setMarket] = useState(""),
    [selection, setSelection] = useState("");
  const [review, setReview] = useState<PreviewReview | null>(null),
    [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [now, setNow] = useState(0);
  const [key, setKey] = useState("");
  const request = useRef<AbortController | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    request.current = controller;
    void fetch("/api/preview-edges", {
      cache: "no-store",
      signal: controller.signal,
      credentials: "same-origin",
      redirect: "error",
    })
      .then(async (r) => {
        const value = await r.json();
        if (!controller.signal.aborted) {
          setData(r.ok && value.status === "READY" ? value : null);
          if (!r.ok)
            setMessage(
              "Preview fixture access is unavailable. Your entitlement may have expired or been revoked.",
            );
        }
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setMessage(
            "Preview fixtures could not be loaded. No record was created.",
          );
      });
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      request.current?.abort();
      clearInterval(timer);
    };
  }, []);
  function reset() {
    request.current?.abort();
    setBusy(false);
    setReview(null);
    setConfirmed(false);
    setMessage("");
  }
  const chosen = data?.options.find((o) => o.id === event && o.sport === sport);
  const expired = review !== null && now >= Date.parse(review.expiresAt);
  async function act(action: "review" | "submit", e: FormEvent) {
    e.preventDefault();
    if (busy || (action === "submit" && (!review || !confirmed || expired)))
      return;
    const controller = new AbortController();
    request.current?.abort();
    request.current = controller;
    setBusy(true);
    setMessage("");
    try {
      const body =
        action === "review"
          ? { action, fixtureId: event, selection }
          : {
              action,
              reviewId: review!.id,
              reviewToken: review!.reviewToken,
              confirmed,
              idempotencyKey: key,
            };
      const r = await fetch("/api/preview-edges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        credentials: "same-origin",
        redirect: "error",
        signal: controller.signal,
      });
      const value = await r.json();
      if (controller.signal.aborted) return;
      if (!r.ok) {
        setReview(null);
        setConfirmed(false);
        setData(null);
        throw new Error(
          "Preview access or price review could not be confirmed. Reload this page to try again.",
        );
      }
      if (action === "review") {
        setReview(value.review);
        setNow(Date.now());
        setConfirmed(false);
        setKey(crypto.randomUUID());
      } else {
        setData((old) =>
          old && review
            ? {
                ...old,
                records: [
                  {
                    id: value.id,
                    submittedAt: value.submittedAt,
                    review,
                    label: previewPriceLabel,
                    status: "PREVIEW_ONLY" as const,
                  },
                  ...old.records.filter((r) => r.id !== value.id),
                ].slice(0, 20),
              }
            : old,
        );
        setReview(null);
        setConfirmed(false);
        setMessage(
          "PREVIEW test record saved. It is excluded from all real performance and rankings.",
        );
      }
    } catch (error) {
      if (!controller.signal.aborted)
        setMessage(
          error instanceof Error
            ? error.message
            : "Preview request not confirmed.",
        );
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  }
  return (
    <section
      className="app-panel preview-fixture-composer"
      aria-labelledby="preview-fixture-title"
    >
      <p className="eyebrow">{previewPriceLabel}</p>
      <h2 id="preview-fixture-title">Practise the Edge flow.</h2>
      <p>
        Fictional events and synthetic prices. No wagers, genuine results or
        real ranking are created.
      </p>
      {data && (
        <form
          className="app-form"
          method="post"
          onSubmit={(e) => act("review", e)}
        >
          <label>
            Sport
            <select
              value={sport}
              onChange={(e) => {
                reset();
                setSport(e.target.value);
                setEvent("");
                setMarket("");
                setSelection("");
              }}
              required
            >
              <option value="">Choose a DEMO sport</option>
              {[...new Set(data.options.map((o) => o.sport))].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
          <label>
            Event
            <select
              value={event}
              onChange={(e) => {
                reset();
                setEvent(e.target.value);
                setMarket("");
                setSelection("");
              }}
              required
              disabled={!sport}
            >
              <option value="">Choose a fictional event</option>
              {data.options
                .filter((o) => o.sport === sport)
                .map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.event}
                  </option>
                ))}
            </select>
          </label>
          <label>
            Market
            <select
              value={market}
              onChange={(e) => {
                reset();
                setMarket(e.target.value);
                setSelection("");
              }}
              required
              disabled={!chosen}
            >
              <option value="">Choose matching rules</option>
              {chosen && <option value={chosen.market}>{chosen.market}</option>}
            </select>
          </label>
          <label>
            Selection
            <select
              value={selection}
              onChange={(e) => {
                reset();
                setSelection(e.target.value);
              }}
              required
              disabled={!market}
            >
              <option value="">Choose a DEMO selection</option>
              {chosen?.selections.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
          <button className="button" disabled={busy || !selection}>
            Review DEMO market reference
          </button>
        </form>
      )}
      {review && (
        <form
          className="app-form preview-price-review"
          method="post"
          onSubmit={(e) => act("submit", e)}
        >
          <p className="eyebrow">{previewPriceLabel}</p>
          <h3>{review.selection}</h3>
          <p>
            {review.event} · {review.market}
          </p>
          <p>
            <strong>
              DEMO Market Reference {review.reference.decimalPrice} decimal
            </strong>
          </p>
          <p>
            {review.reference.availability.sourceCount} synthetic independent
            availability sources · same reference aggregation used by Docked.
          </p>
          <p>
            Simulated start:{" "}
            <time dateTime={review.startAt}>
              {new Date(review.startAt).toLocaleString()}
            </time>
            . This is not a scheduled sporting event.
          </p>
          <p>
            {expired
              ? "Preview review expired. Review again before confirming."
              : "Review expires after 90 seconds; submission rechecks access and the captured price."}
          </p>
          <label className="check">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              disabled={expired || busy}
              required
            />
            <span>{previewPermanentStatement}</span>
          </label>
          <button className="button" disabled={busy || !confirmed || expired}>
            Save permanent PREVIEW record
          </button>
        </form>
      )}
      <p role="status" className="form-message">
        {message}
      </p>
      {!!data?.records.length && (
        <section>
          <h3>Your preview test records</h3>
          <p>
            Latest 20 only. No settlement, points, ROI or ranking is assigned.
          </p>
          {data.records.map((record) => (
            <article className="card" key={record.id}>
              <p className="eyebrow">{previewPriceLabel}</p>
              <strong>{record.review.selection}</strong>
              <p>{record.review.event}</p>
              <p>
                Captured DEMO reference {record.review.reference.decimalPrice}{" "}
                decimal
              </p>
              <small>PREVIEW ONLY · excluded from real records</small>
            </article>
          ))}
        </section>
      )}
    </section>
  );
}

"use client";
import { useRef, useState } from "react";
import { DateTime } from "luxon";
import { boundedFetch } from "@/core/bounded-request";
import type { adminCoupons } from "@/server/pack-coupons";
import type { CouponTerms } from "@/core/pack-coupons";
import { FantasySheet } from "./fantasy-player-sheet";
type Data = Awaited<ReturnType<typeof adminCoupons>>;
export function AdminPackCoupons({ initial }: { initial: Data }) {
  const [data, setData] = useState(initial),
    [code, setCode] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [editing, setEditing] = useState<Data["campaigns"][number] | null>(
      null,
    ),
    [sport, setSport] = useState<CouponTerms["sport"]>("nfl");
  const [review, setReview] = useState<Data["campaigns"][number] | null>(null);
  const flight = useRef(false),
    pending = useRef<{ request: string; mutation: unknown } | null>(null);
  async function mutate(mutation: unknown) {
    if (flight.current) return;
    flight.current = true;
    setBusy(true);
    setError("");
    if (
      pending.current &&
      JSON.stringify(pending.current.mutation) !== JSON.stringify(mutation)
    ) {
      setError("Retry the pending request before another change.");
      flight.current = false;
      setBusy(false);
      return;
    }
    pending.current ??= { request: crypto.randomUUID(), mutation };
    try {
      const r = await boundedFetch("/api/admin/pack-coupons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(pending.current),
      });
      const v = await r.json();
      if (!r.ok) {
        if (r.status === 400 || r.status === 409 || r.status === 403)
          pending.current = null;
        throw Error(v.error);
      }
      setData(v);
      pending.current = null;
      setReview(null);
      setEditing(null);
      setCode("");
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Change not confirmed. Retry the same request.",
      );
    } finally {
      setBusy(false);
      flight.current = false;
    }
  }
  return (
    <section className="scoring-review">
      <h1>Pack coupons</h1>
      <p>
        Discounts reduce pack charges. They never add wallet credits. New offers
        are saved as drafts.
      </p>
      {error && (
        <p role="alert">
          {error}{" "}
          {pending.current && (
            <button
              disabled={busy}
              onClick={() => void mutate(pending.current!.mutation)}
            >
              Retry pending change
            </button>
          )}
        </p>
      )}
      <form
        key={editing ? `${editing.code}:${editing.revision}` : "new"}
        className="app-form"
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          const terms: CouponTerms = {
            code,
            type: f.get("type") as CouponTerms["type"],
            value: Number(f.get("value")),
            sport,
            products: f.getAll("products").map(String),
            startsAt: DateTime.fromISO(String(f.get("starts")), {
              zone: "Australia/Sydney",
            }).toMillis(),
            expiresAt: DateTime.fromISO(String(f.get("expires")), {
              zone: "Australia/Sydney",
            }).toMillis(),
            totalLimit: Number(f.get("total")),
            accountLimit: Number(f.get("account")),
            maximumDiscount: Number(f.get("maximum")),
            firstPurchaseOnly: f.get("first") === "on",
            allowZero: f.get("zero") === "on",
          };
          void mutate({
            action: "save",
            terms,
            expectedRevision: editing?.revision ?? 0,
          });
        }}
      >
        <h2>{editing ? `Edit ${editing.code}` : "Create coupon"}</h2>
        {editing && (
          <button
            type="button"
            onClick={() => {
              setEditing(null);
              setCode("");
            }}
          >
            Create a new coupon
          </button>
        )}
        <label>
          Sport
          <select
            value={sport}
            onChange={(e) => setSport(e.target.value as CouponTerms["sport"])}
          >
            <option value="nfl">NFL</option>
            <option value="football">EPL</option>
            <option value="afl">AFL</option>
          </select>
        </label>
        <div className="form-split">
          <label>
            Code
            <input
              readOnly={!!editing}
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              required
              minLength={3}
              maxLength={32}
              pattern="[A-Za-z0-9][A-Za-z0-9_-]{2,31}"
            />
          </label>
          <button
            type="button"
            disabled={busy || !!editing}
            onClick={() => setCode(data.generatedCode)}
          >
            Generate secure code
          </button>
        </div>
        <div className="form-split">
          <label>
            Discount type
            <select name="type" defaultValue={editing?.type ?? "percent"}>
              <option value="percent">Percentage</option>
              <option value="fixed">Fixed credits</option>
            </select>
          </label>
          <label>
            Value
            <input
              type="number"
              name="value"
              defaultValue={editing?.value}
              required
              min={1}
              step={1}
              max={1000000000}
            />
          </label>
        </div>
        <fieldset>
          <legend>Eligible products</legend>
          {data.products
            .filter((p) => p.sport === sport)
            .map((p) => (
              <label className="check" key={p.id}>
                <input
                  type="checkbox"
                  name="products"
                  value={p.id}
                  defaultChecked={editing?.products.includes(p.id)}
                />
                {p.name} · {p.price.toLocaleString("en-AU")} credits
              </label>
            ))}
        </fieldset>
        <div className="form-split">
          <label>
            Starts · Sydney
            <input
              type="datetime-local"
              name="starts"
              defaultValue={
                editing
                  ? DateTime.fromMillis(editing.startsAt, {
                      zone: "Australia/Sydney",
                    }).toFormat("yyyy-MM-dd\'T\'HH:mm")
                  : undefined
              }
              required
            />
          </label>
          <label>
            Expires · Sydney
            <input
              type="datetime-local"
              name="expires"
              defaultValue={
                editing
                  ? DateTime.fromMillis(editing.expiresAt, {
                      zone: "Australia/Sydney",
                    }).toFormat("yyyy-MM-dd\'T\'HH:mm")
                  : undefined
              }
              required
            />
          </label>
        </div>
        <div className="form-split">
          <label>
            Total successful uses
            <input
              type="number"
              name="total"
              defaultValue={editing?.totalLimit}
              required
              min={1}
              max={1000000000}
              step={1}
            />
          </label>
          <label>
            Uses per account
            <input
              type="number"
              name="account"
              required
              defaultValue={editing?.accountLimit ?? 1}
              min={1}
              max={1000000000}
              step={1}
            />
          </label>
          <label>
            Maximum discount per purchase
            <input
              type="number"
              name="maximum"
              defaultValue={editing?.maximumDiscount}
              required
              min={1}
              max={1000000000}
              step={1}
            />
          </label>
        </div>
        <label className="check">
          <input
            type="checkbox"
            name="first"
            defaultChecked={editing?.firstPurchaseOnly}
          />
          First successful pack purchase only
        </label>
        <label className="check">
          <input
            type="checkbox"
            name="zero"
            defaultChecked={editing?.allowZero}
          />
          Explicitly allow a zero-credit purchase
        </label>
        <p className="small-note">
          No stacking. Percentage savings round half up to whole credits. Free
          weekly/reward packs and failed attempts do not count as a first
          purchase. Successful zero-credit coupon purchases do count. Coupon use
          is not restored automatically by a refund; any authorised refund is
          limited to credits actually paid.
        </p>
        <button className="pack-control primary" disabled={busy}>
          Save draft
        </button>
      </form>
      <h2>Offers</h2>
      {!data.campaigns.length && (
        <p>No coupons created. No campaign is active.</p>
      )}
      {data.campaigns.map((c) => (
        <article className="app-panel" key={c.code}>
          <h3>
            {c.code} · {c.effectiveStatus}
          </h3>
          <button
            disabled={busy}
            onClick={() => {
              setEditing(c);
              setSport(c.sport);
              setCode(c.code);
            }}
          >
            Edit as draft
          </button>
          <p>
            {c.type === "percent" ? `${c.value}%` : `${c.value} credits`} off ·
            Maximum {c.maximumDiscount.toLocaleString("en-AU")} credits per
            purchase
          </p>
          <p>
            {c.successful} successful uses ·{" "}
            {c.discounted.toLocaleString("en-AU")} credits discounted ·{" "}
            {c.remaining} uses remaining
          </p>
          <p>Maximum discount allocation: {c.maximumAllocation} credits</p>
          <button
            className="pack-control secondary"
            disabled={busy}
            onClick={() => setReview(c)}
          >
            Review {c.status === "active" ? "offer" : "activation"}
          </button>
          {c.status === "active" && (
            <button
              className="pack-control secondary"
              disabled={busy}
              onClick={() =>
                void mutate({
                  action: "pause",
                  code: c.code,
                  expectedRevision: c.revision,
                })
              }
            >
              Pause future use
            </button>
          )}
        </article>
      ))}
      <details>
        <summary>Successful redemptions ({data.redemptions.length})</summary>
        {data.redemptions.map((r) => (
          <article className="app-panel" key={r.purchase}>
            <strong>{r.coupon.code} · Completed</strong>
            <p>
              {r.product} · {r.memberLabel} · Account {r.member}
            </p>
            <p>
              Original {r.original} · Saved {r.saving} · Paid {r.charge} credits
            </p>
            <p>
              {new Date(r.at).toLocaleString("en-AU", {
                timeZone: "Australia/Sydney",
              })}{" "}
              Sydney · Purchase {r.purchase}
            </p>
          </article>
        ))}
      </details>
      {review && (
        <FantasySheet title="Review coupon" onClose={() => setReview(null)}>
          <h3>{review.code}</h3>
          <p>
            {review.type === "percent"
              ? `${review.value}%`
              : `${review.value} credits`}{" "}
            off, capped at {review.maximumDiscount} credits.{" "}
            {review.accountLimit} use(s) per account; {review.totalLimit} total.
          </p>
          <ul>
            {review.products.map((id) => (
              <li key={id}>
                {data.products.find((p) => p.id === id)?.name ?? id}
              </li>
            ))}
          </ul>
          <p>
            {new Date(review.startsAt).toLocaleString("en-AU", {
              timeZone: "Australia/Sydney",
            })}{" "}
            —{" "}
            {new Date(review.expiresAt).toLocaleString("en-AU", {
              timeZone: "Australia/Sydney",
            })}{" "}
            Sydney
          </p>
          <p>
            {review.firstPurchaseOnly
              ? "First purchase only."
              : "Previous purchasers eligible."}{" "}
            {review.allowZero
              ? "Zero-credit purchases permitted."
              : "Minimum charge: 1 credit."}
          </p>
          <p>
            Maximum discount allocation: {review.maximumAllocation} credits.
            Pack odds and contents remain unchanged.
          </p>
          {review.status !== "active" && (
            <button
              className="pack-control primary"
              disabled={busy}
              onClick={() =>
                void mutate({
                  action: "activate",
                  code: review.code,
                  expectedRevision: review.revision,
                })
              }
            >
              Activate reviewed offer
            </button>
          )}
        </FantasySheet>
      )}
    </section>
  );
}

import Link from "next/link";
import { oddsDisplay } from "@/core/pricing";
import {
  localEventTime,
  sourceAge,
  type TipPresentation,
} from "@/core/tip-presentation";
import { QuoteStatus } from "./quote-status";
import { SportIcon } from "./sport-icon";
import { NativeShare } from "./native-share";

export function EdgeCard({
  tip,
  timezone = "Australia/Melbourne",
  format = "decimal",
  now = Date.now(),
  detail = false,
  headingLevel = 2,
  compact = false,
}: {
  tip: TipPresentation;
  timezone?: string;
  format?: "decimal" | "fractional" | "american";
  now?: number;
  detail?: boolean;
  headingLevel?: 2 | 3;
  compact?: boolean;
}) {
  const Heading = headingLevel === 2 ? "h2" : "h3";
  const reference = tip.pricing_model === "market_reference_v1";
  const current = reference
    ? (tip.current_market_reference?.decimalPrice ?? null)
    : tip.current_odds;
  const sourceAt = reference
    ? (tip.current_market_reference?.sourceAt ?? null)
    : tip.current_source_at;
  const market =
    tip.market_rules.market === "football_1x2"
      ? "Match result · 1X2"
      : tip.market_rules.market === "nba_moneyline"
        ? "Moneyline"
        : tip.market_rules.market;
  if (compact && !detail)
    return (
      <article
        className="card edge-card compact-edge-card"
        aria-label={`${tip.participants.join(" vs ")}: ${tip.selection}`}
      >
        <div className="compact-edge-meta">
          <span>
            <SportIcon
              sport={
                tip.market_rules.market.startsWith("nba_")
                  ? "basketball"
                  : tip.market_rules.market
              }
              size={18}
            />{" "}
            DOCKED · OFFICIAL
          </span>
          <time dateTime={new Date(tip.start_at).toISOString()}>
            {localEventTime(tip.start_at, timezone)}
          </time>
        </div>
        <p className="edge-event">{tip.participants.join(" vs ")}</p>
        <Heading className="compact-edge-selection">{tip.selection}</Heading>
        <p className="edge-market">
          {market} · {tip.market_rules.settlement.replaceAll("_", " ")}
        </p>
        <QuoteStatus
          status={tip.display_status}
          sourceAt={sourceAt ? new Date(sourceAt).toISOString() : null}
          startAt={new Date(tip.start_at).toISOString()}
          initialNow={now}
        />
        <div className="compact-edge-prices">
          <div className="take-price">
            <span>Minimum acceptable price</span>
            <strong>TAKE {oddsDisplay(tip.minimum_odds, format)}+</strong>
          </div>
          <div>
            <span>
              {reference ? "CURRENT MARKET" : "Current observed price"}
            </span>
            <strong>
              {current === null ? "Unavailable" : oddsDisplay(current, format)}
            </strong>
          </div>
          <div>
            <span>
              {reference ? "Docked fair price" : "Reference fair odds"}
            </span>
            <strong>
              {oddsDisplay(tip.publication_payload.fairOdds, format)}
            </strong>
            <small>Locked estimate</small>
          </div>
          <div>
            <span>Estimated EV at publication</span>
            <strong>{(Number(tip.estimated_ev) * 100).toFixed(2)}%</strong>
          </div>
        </div>
        <p className="small-note">
          {reference ? "Publication market reference" : "Publication odds"}:{" "}
          {tip.odds} decimal ·{" "}
          {reference
            ? "Methodology UNVALIDATED"
            : tip.publication_payload.offer.bookmaker}
        </p>
        <p className="edge-freshness">
          Source age at page load: {sourceAge(sourceAt, now)} · {timezone}
        </p>
        {tip.result !== "pending" && (
          <p className="edge-settlement">
            Settlement: <strong>{tip.result}</strong>
          </p>
        )}
        <div className="compact-edge-footer">
          <Link href={`/tips/${tip.id}`} className="text-link">
            View details and corrections ↗
          </Link>
          <p className="edge-warning">
            Estimated EV is not guaranteed profit.
            {tip.display_status !== "active" &&
              " Archived record; not an active instruction."}
          </p>
        </div>
      </article>
    );
  return (
    <article
      className="card edge-card"
      aria-label={`${tip.participants.join(" vs ")}: ${tip.selection}`}
    >
      <div className="edge-card-top">
        <QuoteStatus
          status={tip.display_status}
          sourceAt={sourceAt ? new Date(sourceAt).toISOString() : null}
          startAt={new Date(tip.start_at).toISOString()}
          initialNow={now}
        />
        <span className="small-note">LIVE PUBLICATION RECORD</span>
      </div>
      <p className="edge-event">
        <SportIcon
          sport={
            tip.market_rules.market.startsWith("nba_")
              ? "basketball"
              : tip.market_rules.market
          }
          className="edge-sport-icon"
          size={22}
        />
        <span>{tip.participants.join(" vs ")}</span>
      </p>
      <Heading>{tip.selection}</Heading>
      <p className="edge-market">
        {market} · {tip.market_rules.settlement.replaceAll("_", " ")}
      </p>
      <dl className="edge-facts">
        <div>
          <dt>When</dt>
          <dd>
            <time dateTime={new Date(tip.start_at).toISOString()}>
              {localEventTime(tip.start_at, timezone)}
            </time>
            <small>{timezone}</small>
          </dd>
        </div>
        <div>
          <dt>{reference ? "Price basis" : "Where"}</dt>
          <dd>
            {reference
              ? "Independent market reference"
              : tip.publication_payload.offer.bookmaker}
            <small>
              {reference
                ? "Compare your available price with the minimum. Execution is not guaranteed."
                : "Original bookmaker methodology · personal limits unknown."}
            </small>
          </dd>
        </div>
      </dl>
      <div className={`edge-prices ${reference ? "reference-prices" : ""}`}>
        {reference && (
          <div className="take-price">
            <span>Minimum acceptable price</span>
            <strong>TAKE {oddsDisplay(tip.minimum_odds, format)}+</strong>
            <small>Decimal {tip.minimum_odds}+ · do not accept less</small>
          </div>
        )}
        <div>
          <span>{reference ? "CURRENT MARKET" : "Current observed price"}</span>
          <strong>
            {current === null ? "Unavailable" : oddsDisplay(current, format)}
          </strong>
          <small>
            {current === null
              ? "No verified current quote"
              : `${format} · decimal ${current}`}
          </small>
        </div>
        {!reference && (
          <div>
            <span>Minimum acceptable price</span>
            <strong>{oddsDisplay(tip.minimum_odds, format)}</strong>
            <small>Decimal {tip.minimum_odds} · do not accept less</small>
          </div>
        )}
      </div>
      {reference && (
        <p className="reference-fair">
          Docked fair price{" "}
          <strong>
            {oddsDisplay(tip.publication_payload.fairOdds, format)}
          </strong>
          <span> Locked estimate at publication · methodology UNVALIDATED</span>
        </p>
      )}
      <p className="edge-freshness">
        Source age at page load: {sourceAge(sourceAt, now)}
        {sourceAt && (
          <>
            {" "}
            ·{" "}
            <time dateTime={new Date(sourceAt).toISOString()}>
              {localEventTime(sourceAt, timezone)}
            </time>
          </>
        )}
        . Check the latest price before relying on this record.
      </p>
      {tip.published_at && (
        <p className="small-note">
          Published{" "}
          <time dateTime={new Date(tip.published_at).toISOString()}>
            {localEventTime(tip.published_at, timezone)}
          </time>{" "}
          · immutable decision record
        </p>
      )}
      <details className="edge-evidence" open={detail}>
        <summary>Why it qualified at publication</summary>
        <dl className="edge-facts">
          <div>
            <dt>Estimated probability</dt>
            <dd>{(Number(tip.probability) * 100).toFixed(2)}%</dd>
          </div>
          <div>
            <dt>{reference ? "Docked fair price" : "Reference fair odds"}</dt>
            <dd>{tip.publication_payload.fairOdds}</dd>
          </div>
          <div>
            <dt>Estimated EV</dt>
            <dd>{(Number(tip.estimated_ev) * 100).toFixed(2)}%</dd>
          </div>
          <div>
            <dt>
              {reference
                ? "Market reference at publication"
                : "Publication odds"}
            </dt>
            <dd>{tip.odds} decimal</dd>
          </div>
        </dl>
        {reference ? (
          <p>
            The market reference is an observed availability benchmark. The
            Docked fair price is a separate probability estimate; the minimum
            includes the configured edge threshold. Publication values are
            immutable. Current observations do not rewrite settlement or
            research evidence. This methodology remains UNVALIDATED.
          </p>
        ) : (
          <p>
            The recorded price exceeded the minimum calculated from complete,
            margin-adjusted reference markets. Related bookmakers and the
            offered bookmaker are excluded from their own reference. These are
            the estimates locked at publication; later observations do not
            rewrite them.
          </p>
        )}
        {reference && tip.publication_market_reference && (
          <p className="small-note">
            Methodology {tip.publication_market_reference.methodologyVersion} ·{" "}
            {tip.publication_market_reference.sourceCount} independent sources
            at publication · source time{" "}
            {localEventTime(
              tip.publication_market_reference.sourceAt,
              timezone,
            )}
          </p>
        )}
      </details>
      <p className="edge-warning">
        Estimated EV is not guaranteed profit.{" "}
        {tip.display_status === "active"
          ? "Prices can change or be unavailable to you."
          : "This is an archived observation, not an active instruction to act."}
      </p>
      {tip.result !== "pending" && (
        <p className="edge-settlement">
          Settlement: <strong>{tip.result}</strong>
        </p>
      )}
      {!detail && (
        <Link href={`/tips/${tip.id}`} className="text-link">
          Full publication and corrections ↗
        </Link>
      )}
      {detail && (
        <NativeShare
          path={`/tips/${tip.id}`}
          title="Docked official publication record"
        />
      )}
    </article>
  );
}

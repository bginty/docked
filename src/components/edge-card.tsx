import Link from "next/link";
import { oddsDisplay } from "@/core/pricing";
import {
  localEventTime,
  sourceAge,
  type TipPresentation,
} from "@/core/tip-presentation";
import { QuoteStatus } from "./quote-status";

export function EdgeCard({
  tip,
  timezone = "Australia/Melbourne",
  format = "decimal",
  now = Date.now(),
  detail = false,
  headingLevel = 2,
}: {
  tip: TipPresentation;
  timezone?: string;
  format?: "decimal" | "fractional" | "american";
  now?: number;
  detail?: boolean;
  headingLevel?: 2 | 3;
}) {
  const Heading = headingLevel === 2 ? "h2" : "h3";
  const market =
    tip.market_rules.market === "football_1x2"
      ? "Match result · 1X2"
      : tip.market_rules.market === "nba_moneyline"
        ? "Moneyline"
        : tip.market_rules.market;
  return (
    <article
      className="card edge-card"
      aria-label={`${tip.participants.join(" vs ")}: ${tip.selection}`}
    >
      <div className="edge-card-top">
        <QuoteStatus
          status={tip.display_status}
          sourceAt={
            tip.current_source_at
              ? new Date(tip.current_source_at).toISOString()
              : null
          }
          startAt={new Date(tip.start_at).toISOString()}
          initialNow={now}
        />
        <span className="small-note">LIVE PUBLICATION RECORD</span>
      </div>
      <p className="edge-event">{tip.participants.join(" vs ")}</p>
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
          <dt>Where</dt>
          <dd>
            {tip.publication_payload.offer.bookmaker}
            <small>
              Eligibility checked for this region. Personal limits unknown.
            </small>
          </dd>
        </div>
      </dl>
      <div className="edge-prices">
        <div>
          <span>Current observed price</span>
          <strong>
            {tip.current_odds === null
              ? "Unavailable"
              : oddsDisplay(tip.current_odds, format)}
          </strong>
          <small>
            {tip.current_odds === null
              ? "No verified current quote"
              : `${format} · decimal ${tip.current_odds}`}
          </small>
        </div>
        <div>
          <span>Minimum acceptable price</span>
          <strong>{oddsDisplay(tip.minimum_odds, format)}</strong>
          <small>Decimal {tip.minimum_odds} · do not accept less</small>
        </div>
      </div>
      <p className="edge-freshness">
        Source age at page load: {sourceAge(tip.current_source_at, now)}
        {tip.current_source_at && (
          <>
            {" "}
            ·{" "}
            <time dateTime={new Date(tip.current_source_at).toISOString()}>
              {localEventTime(tip.current_source_at, timezone)}
            </time>
          </>
        )}
        . Check the latest price before relying on this record.
      </p>
      <details className="edge-evidence" open={detail}>
        <summary>Why it qualified at publication</summary>
        <dl className="edge-facts">
          <div>
            <dt>Estimated probability</dt>
            <dd>{(Number(tip.probability) * 100).toFixed(2)}%</dd>
          </div>
          <div>
            <dt>Reference fair odds</dt>
            <dd>{tip.publication_payload.fairOdds}</dd>
          </div>
          <div>
            <dt>Estimated EV</dt>
            <dd>{(Number(tip.estimated_ev) * 100).toFixed(2)}%</dd>
          </div>
          <div>
            <dt>Publication odds</dt>
            <dd>{tip.odds} decimal</dd>
          </div>
        </dl>
        <p>
          The recorded price exceeded the minimum calculated from complete,
          margin-adjusted reference markets. Related bookmakers and the offered
          bookmaker are excluded from their own reference. These are the
          estimates locked at publication; later observations do not rewrite
          them.
        </p>
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
    </article>
  );
}

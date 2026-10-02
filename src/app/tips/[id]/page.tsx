import { notFound } from "next/navigation";
import { publicTips } from "@/server/queries";
import { db } from "@/server/db";
import { PageHeading, Notice } from "@/components/ui";
import { ApiForm } from "@/components/forms";
import { identity } from "@/server/auth";
import { oddsDisplay } from "@/core/pricing";
import { EdgeCard } from "@/components/edge-card";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Publication record",
  robots: { index: false, follow: false },
};
export default async function Tip({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const tip = (await publicTips()).find((t) => t.id === id);
  if (!tip) notFound();
  const viewer = await identity();
  const timezone = viewer?.profile.timezone ?? "Australia/Melbourne";
  const format = viewer?.profile.odds_format ?? "decimal";
  const sql = db();
  const [observations, corrections] = await Promise.all([
    sql`select observed_at,odds,qualifies,target_minutes from private.availability_observations where tip_id=${id} order by observed_at desc`,
    sql`select reason,created_at from private.correction_events where tip_id=${id} order by created_at`,
  ]);
  const p = tip.publication_payload;
  return (
    <div className="page">
      <PageHeading
        eyebrow={`LIVE PUBLISHED / ${tip.display_status.replaceAll("_", " ").toUpperCase()}`}
        title={tip.selection}
      />
      <p>
        {tip.participants.join(" vs ")} ·{" "}
        {new Date(tip.start_at).toLocaleString("en-AU", {
          timeZone: timezone,
        })}{" "}
        {timezone}
      </p>
      <EdgeCard tip={tip} timezone={timezone} format={format} detail />
      <div className="grid two">
        <section className="card">
          <h2>Immutable publication</h2>
          <dl className="detail-list">
            {[
              ["Published", tip.published_at.toISOString()],
              ["Bookmaker", p.offer.bookmaker],
              [
                "Publication odds",
                `${oddsDisplay(tip.odds, format)} (${format}); decimal ${tip.odds}`,
              ],
              ["Minimum acceptable odds", tip.minimum_odds],
              [
                "Estimated probability",
                `${(Number(tip.probability) * 100).toFixed(2)}%`,
              ],
              [
                "Estimated EV",
                `${(Number(tip.estimated_ev) * 100).toFixed(2)}%`,
              ],
              ["Reference fair odds", p.fairOdds],
              ["Source timestamp", p.offer.sourceAt],
              ["Market rules", tip.market_rules.settlement],
              ["Strategy", tip.strategy_id],
              ["Benchmark", "One unit"],
              ["Settlement", tip.result],
            ].map(([k, v]) => (
              <div key={k}>
                <dt>{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
          <p>
            Met the recorded reference method at publication. Estimates and
            obtainability remain uncertain; liquidity and individual limits are
            unknown.
          </p>
          <ApiForm
            endpoint="/api/member"
            action="save"
            defaults={{ tipId: id }}
            submit="Save tip"
          >
            <span />
          </ApiForm>
        </section>
        <section className="card">
          <h2>Current observations</h2>
          <p>Current observations never change original publication figures.</p>
          {observations.length ? (
            observations.map((o, i) => (
              <p key={i}>
                {o.observed_at.toISOString()} · {o.odds ?? "N/A"} ·{" "}
                {o.qualifies ? "Qualifies" : "Does not qualify"}
              </p>
            ))
          ) : (
            <p>N/A — no measured observation.</p>
          )}
          <h3>Corrections</h3>
          {corrections.length ? (
            corrections.map((c, i) => (
              <p key={i}>
                {c.created_at.toISOString()} · {c.reason}
              </p>
            ))
          ) : (
            <p>No appended corrections.</p>
          )}
        </section>
      </div>
      <Notice>
        A tip can expire and later settle. Do not follow an expired alert or
        accept a price below the minimum. No result or estimate guarantees a
        return.
      </Notice>
    </div>
  );
}

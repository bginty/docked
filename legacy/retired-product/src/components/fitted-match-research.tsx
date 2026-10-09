import Link from "next/link";
import type { fittedMatchResearch } from "@/server/model-ledger";
import { LocalTimestamp } from "./local-timestamp";

export function FittedMatchResearch({
  data,
}: {
  data: Awaited<ReturnType<typeof fittedMatchResearch>>;
}) {
  if (!data)
    return (
      <section className="app-panel">
        <h2>Independent team model</h2>
        <p>No retained fitted-model observation is available for this match.</p>
      </section>
    );
  return (
    <section className="app-panel">
      <h2>Independent team model</h2>
      <p>
        {data.modelVersion} · {data.status} · Research, unvalidated
      </p>
      <p>
        Model recorded <LocalTimestamp value={data.recordedAt} />. Sporting
        snapshot observed <LocalTimestamp value={data.dataCutoff} />.
      </p>
      <dl className="scanner-metrics">
        {Object.entries(data.strengths).map(([label, value]) => (
          <div key={label}>
            <dt>
              {
                (
                  {
                    homeAttack: "Home attack",
                    homeDefenceWeakness: "Home defensive weakness",
                    awayAttack: "Away attack",
                    awayDefenceWeakness: "Away defensive weakness",
                    homeAdvantage: "Home advantage",
                  } as Record<string, string>
                )[label]
              }
            </dt>
            <dd>{value.toFixed(3)}×</dd>
          </div>
        ))}
      </dl>
      <p>
        Multipliers relative to the fitted league scoring environment. Higher
        defensive weakness means more expected goals conceded. These sporting
        features contain no market prices.
      </p>
      {data.probabilities && (
        <dl className="scanner-metrics">
          {(["home", "draw", "away"] as const).map((outcome) => (
            <div key={outcome}>
              <dt>{outcome}</dt>
              <dd>
                {(Number(data.probabilities![outcome]) * 100).toFixed(2)}% ·
                Fair{" "}
                {data.fairOdds?.[outcome]
                  ? Number(data.fairOdds[outcome]).toFixed(2)
                  : "Unavailable"}
              </dd>
            </div>
          ))}
        </dl>
      )}
      {data.reason && <p>{data.reason}</p>}
      <p>
        Private research evidence, not an official Edge. Market comparison is a
        separate gated step.
      </p>
      <Link
        href={`/admin/model-performance?model=${encodeURIComponent(data.modelVersion)}&window=604800`}
      >
        Inspect the complete prospective cohort
      </Link>
    </section>
  );
}

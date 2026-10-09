import Link from "next/link";
import type { footballCalibration } from "@/core/model-calibration";
import { LocalTimestamp } from "./local-timestamp";
export type ModelPerformanceData = {
  status: "READY" | "NOT_CONFIGURED" | "UNAVAILABLE";
  implementationStatus: string;
  predictions?: {
    id: string;
    eventId: string;
    status: string;
    modelVersion: string;
    recordedAt: string;
    probabilities: { home: string; draw: string; away: string } | null;
    fairOdds: { home: string; draw: string; away: string } | null;
    reason: string | null;
  }[];
  fits?: {
    modelVersion: string;
    fittedHash: string;
    trainingHash: string;
    fittedAt: string;
    diagnostics: Record<string, unknown>;
  }[];
  versions: {
    id: string;
    lifecycle: string;
    configHash: string;
    codeCommit: string;
    createdAt: string;
    changedAt: string;
  }[];
  attempts: {
    total: number;
    ready: number;
    abstained: number;
    notConfigured: number;
  } | null;
  calibration: ReturnType<typeof footballCalibration> | null;
};
const percent = (value: string | null) =>
  value === null ? "Unavailable" : `${(Number(value) * 100).toFixed(1)}%`;
export function ModelPerformancePanel({
  data,
}: {
  data: ModelPerformanceData;
}) {
  const c = data.calibration;
  return (
    <>
      <section className="app-panel">
        <h2>Football Model V1</h2>
        <p>
          <strong>{data.implementationStatus.replaceAll("_", " ")}</strong> ·{" "}
          {data.status}
        </p>
        <p>
          Independent sporting inputs → model probability → Docked fair odds.
          External market prices are compared only after the prediction is
          recorded.
        </p>
        <p>
          {data.implementationStatus === "RESEARCH_FITTED_UNVALIDATED"
            ? "A retained sporting-data research fit is installed. Prospective predictive quality remains unvalidated; live publication is not approved."
            : "No fitted football estimator or authorised sporting dataset is installed. A proposed methodology is not an operational model."}
        </p>
        <dl className="scanner-metrics">
          <div>
            <dt>Evaluations retained</dt>
            <dd>{data.attempts?.total ?? "Unavailable"}</dd>
          </div>
          <div>
            <dt>Predictions recorded</dt>
            <dd>{data.attempts?.ready ?? "Unavailable"}</dd>
          </div>
          <div>
            <dt>Abstentions</dt>
            <dd>{data.attempts?.abstained ?? "Unavailable"}</dd>
          </div>
          <div>
            <dt>Model unavailable</dt>
            <dd>{data.attempts?.notConfigured ?? "Unavailable"}</dd>
          </div>
        </dl>
        {!data.versions.length && (
          <p>
            No model version has been introduced. No prospective probability or
            success metric is inferred.
          </p>
        )}
      </section>
      {!!data.fits?.length && (
        <section className="app-panel">
          <h2>Retained fitted revisions</h2>
          {data.fits.map((f) => (
            <details key={f.modelVersion}>
              <summary>{f.modelVersion}</summary>
              <p>
                Fitted <LocalTimestamp value={f.fittedAt} />
              </p>
              <p>
                Training hash: <code>{f.trainingHash}</code>
              </p>
              <p>
                Fitted state hash: <code>{f.fittedHash}</code>
              </p>
              <p>
                Accepted training matches:{" "}
                {String(f.diagnostics.matches ?? "Unavailable")}. Numerical
                convergence is not predictive validation.
              </p>
            </details>
          ))}
        </section>
      )}
      {!!data.predictions?.length && (
        <section className="app-panel">
          <h2>Prospective prediction ledger</h2>
          <p>
            Private research estimates. These are not official Edges or betting
            recommendations.
          </p>
          {data.predictions.map((p) => (
            <details key={p.id}>
              <summary>
                {p.eventId} · {p.status}
              </summary>
              <p>
                {p.modelVersion} · <LocalTimestamp value={p.recordedAt} />
              </p>
              {p.probabilities && (
                <dl className="scanner-metrics">
                  {(["home", "draw", "away"] as const).map((outcome) => (
                    <div key={outcome}>
                      <dt>{outcome}</dt>
                      <dd>
                        {percent(p.probabilities![outcome])} · Fair{" "}
                        {p.fairOdds?.[outcome]
                          ? Number(p.fairOdds[outcome]).toFixed(2)
                          : "Unavailable"}
                      </dd>
                    </div>
                  ))}
                </dl>
              )}
              {p.reason && <p>{p.reason}</p>}
              <p>
                Immutable prediction: <code>{p.id}</code>
              </p>
            </details>
          ))}
        </section>
      )}
      <section className="app-panel">
        <h2>Forward calibration</h2>
        <p>
          Every eligible prediction in the selected model and decision window
          counts, whether or not it qualifies as an Edge. This is predictive
          quality, not betting ROI.
        </p>
        {c ? (
          <>
            <p>
              Model {c.modelVersion} · decision window {c.decisionWindow}
            </p>
            <p>
              <LocalTimestamp value={c.from} /> to{" "}
              <LocalTimestamp value={c.to} />
            </p>
            <dl className="scanner-metrics">
              <div>
                <dt>Predictions settled</dt>
                <dd>{c.settled}</dd>
              </div>
              <div>
                <dt>Pending outcomes</dt>
                <dd>{c.pending}</dd>
              </div>
              <div>
                <dt>Void outcomes</dt>
                <dd>{c.voids}</dd>
              </div>
              <div>
                <dt>Brier score (0–2)</dt>
                <dd>{c.brierScore ?? "Unavailable"}</dd>
              </div>
              <div>
                <dt>Log loss</dt>
                <dd>
                  {c.logLossStatus === "INFINITE"
                    ? "Infinite — realised outcome had zero probability"
                    : (c.logLoss ?? "Unavailable")}
                </dd>
              </div>
              <div>
                <dt>Abstention rate</dt>
                <dd>{percent(c.abstentionRate)}</dd>
              </div>
              <div>
                <dt>Data failure rate</dt>
                <dd>{percent(c.failureRate)}</dd>
              </div>
              <div>
                <dt>Drift / uncertainty</dt>
                <dd>Not established</dd>
              </div>
            </dl>
            <div
              className="table-wrap"
              tabIndex={0}
              role="region"
              aria-label="Probability calibration buckets"
            >
              <table>
                <caption>
                  Complete prospective cohort · fixed probability buckets
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Outcome</th>
                    <th scope="col">Bucket</th>
                    <th scope="col">Observations</th>
                    <th scope="col">Mean prediction</th>
                    <th scope="col">Observed frequency</th>
                  </tr>
                </thead>
                <tbody>
                  {c.buckets.map((b) => (
                    <tr key={`${b.selection}-${b.index}`}>
                      <th scope="row">{b.selection}</th>
                      <td>
                        {b.lower}–{b.upper}
                      </td>
                      <td>{b.count}</td>
                      <td>{percent(b.meanProbability)}</td>
                      <td>{percent(b.observedFrequency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <p>
            No scored prospective cohort is available. Brier score, log loss,
            calibration, missing-data rates and drift remain unavailable.
          </p>
        )}
      </section>
      <section className="app-panel">
        <h2>Immutable model versions</h2>
        {data.versions.map((v) => (
          <article key={v.id}>
            <h3>{v.id}</h3>
            <p>{v.lifecycle.replaceAll("_", " ")}</p>
            <p>
              Registered <LocalTimestamp value={v.createdAt} /> · reviewed{" "}
              <LocalTimestamp value={v.changedAt} />
            </p>
            <details>
              <summary>Version provenance</summary>
              <p>
                Config <code>{v.configHash}</code>
              </p>
              <p>
                Code <code>{v.codeCommit}</code>
              </p>
            </details>
          </article>
        ))}
        <p>
          Material input, feature or methodology changes require a new version.
          Earlier probabilities remain unchanged.
        </p>
      </section>
      <section className="app-panel">
        <h2>Separate records</h2>
        <p>
          Model calibration, paper Edge performance, the official Docked record
          and community performance are separate datasets.
        </p>
        <div className="actions">
          <Link href="/admin/forward-paper">Paper validation</Link>
          <Link href="/results">Official Docked record</Link>
          <Link href="/top-docked">Community performance</Link>
          <Link href="/methodology">Methodology</Link>
        </div>
      </section>
    </>
  );
}

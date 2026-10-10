"use client";
import { useState } from "react";
import { points, sports, type Rules, type Sport } from "@/core/scoring-v1";
import type { results, Audit } from "@/core/scoring-engine";
type Result = ReturnType<typeof results>;
type Stage = "pending" | "initial" | "corrected" | "final";
export type ScoringDemo = Record<
  Sport,
  {
    rules: Rules;
    pending: Result;
    initial: Result;
    corrected: Result;
    final: Result;
    audits: Audit[];
  }
>;
const stages: { value: Stage; label: string }[] = [
  { value: "pending", label: "Awaiting data" },
  { value: "initial", label: "First statistics" },
  { value: "corrected", label: "Corrected statistics" },
  { value: "final", label: "Finalised" },
];
export function ScoringReview({ data }: { data: ScoringDemo }) {
  const [sport, setSport] = useState<Sport>("epl");
  const [stage, setStage] = useState<Stage>("initial");
  const demo = data[sport],
    view = demo[stage];
  return (
    <section className="scoring-review">
      <p className="scoring-badge">SCORING LAB · SIMULATED DATA</p>
      <h1>Every point, explained.</h1>
      <p>
        Explore two fictional teams and their saved scoring history. These are
        synthetic fixtures, not real match results or your cards. No live feed
        is connected for EPL, NFL or AFL.
      </p>
      <p>
        <a href="/fantasy/scoring/how-it-works">How scoring works →</a> ·{" "}
        <a href="/fantasy/play">Back to Play</a>
      </p>
      <div className="scoring-controls">
        <label>
          Sport
          <select
            value={sport}
            onChange={(e) => setSport(e.target.value as Sport)}
          >
            {sports.map((s) => (
              <option key={s} value={s}>
                {s.toUpperCase()} · simulated only
              </option>
            ))}
          </select>
        </label>
        <label>
          Recorded stage
          <select
            value={stage}
            onChange={(e) => setStage(e.target.value as Stage)}
          >
            {stages.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div role="status">
        <h2>{demo.rules.title}</h2>
        <p>
          {view.period} ·{" "}
          {stage === "pending"
            ? "Pending data — standings withheld"
            : stage === "final"
              ? "Final · synthetic scenario"
              : "Provisional · synthetic scenario"}
        </p>
        <p>
          Last updated in this scenario:{" "}
          <time dateTime={view.updatedAt}>
            {view.updatedAt.replace("T", " ").replace("Z", " UTC")}
          </time>
        </p>
      </div>
      <p className="notice">
        Changing the recorded stage replays stored server calculations. It does
        not import statistics or change your account. Corrections replace
        totals; they never award points twice.
      </p>
      <div className="scoring-teams">
        {view.rows.map((team) => (
          <article key={team.member} className="scoring-team">
            <h3>{team.name}</h3>
            <p className="scoring-total">
              {team.centipoints === null
                ? "Pending data"
                : `${points(team.centipoints)} match points`}
            </p>
            <p>
              {team.rank === null
                ? `Known subtotal: ${points(team.knownCentipoints)} · not a final zero`
                : `Rank ${team.rank} in this ${sport.toUpperCase()} period`}{" "}
              · {team.status}
            </p>
            {team.players.map((p, i) => (
              <details key={p.cardId}>
                <summary>
                  {p.position} · Synthetic player {i + 1}
                  <strong>
                    {p.centipoints === null ? "Pending" : points(p.centipoints)}
                  </strong>
                </summary>
                {p.matches.map((match) => (
                  <div key={match.fixtureId} className="scoring-breakdown">
                    <p>
                      {match.fixtureId} · {match.status} · Revision{" "}
                      {match.revision ?? "not received"}
                    </p>
                    {match.statistics &&
                    typeof match.statistics === "object" ? (
                      <details>
                        <summary>
                          Source statistics · {match.availability}
                        </summary>
                        <dl>
                          {Object.entries(match.statistics).map(
                            ([key, value]) => (
                              <div key={key}>
                                <dt>
                                  {key
                                    .replaceAll("_", " ")
                                    .replace(/([a-z])([A-Z])/g, "$1 $2")}
                                </dt>
                                <dd>{String(value)}</dd>
                              </div>
                            ),
                          )}
                        </dl>
                        {sport === "epl" && (
                          <p>
                            Regulation seconds exclude added time; played
                            seconds include it.
                          </p>
                        )}
                      </details>
                    ) : null}
                    {match.score ? (
                      <table>
                        <caption>Point breakdown · {p.position}</caption>
                        <thead>
                          <tr>
                            <th scope="col">Statistic</th>
                            <th scope="col">Quantity</th>
                            <th scope="col">Points earned</th>
                          </tr>
                        </thead>
                        <tbody>
                          {match.score.parts.map((part) => (
                            <tr key={part.statistic}>
                              <th scope="row">
                                {part.statistic.replaceAll("_", " ")}
                              </th>
                              <td>{part.quantity}</td>
                              <td>{points(part.centipoints)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <p>
                        Statistics unavailable. No final score has been
                        assigned.
                      </p>
                    )}
                  </div>
                ))}
              </details>
            ))}
          </article>
        ))}
      </div>
      <details>
        <summary>Rules and immutable audit history</summary>
        <p>
          Rules: {view.rulesVersion}. Same performance, same points for every
          rarity. Engagement rewards are separate.
        </p>
        <ol>
          {demo.audits.map((a) => (
            <li key={a.sequence}>
              {a.at}: {a.action} — {a.reason}
            </li>
          ))}
        </ol>
      </details>
    </section>
  );
}

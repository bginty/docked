import { scoringRows } from "@/core/scoring-release";
import type { Rules } from "@/core/scoring-v1";
export function ScoringRulesTable({ rules }: { rules: Rules }) {
  return (
    <>
      <table>
        <caption>{rules.title}</caption>
        <thead>
          <tr>
            <th scope="col">Action</th>
            <th scope="col">Points</th>
          </tr>
        </thead>
        <tbody>
          {scoringRows(rules).map((row) => (
            <tr key={row.action}>
              <th scope="row">{row.action}</th>
              <td>{row.points}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <details>
        <summary>Eligibility, exceptions and corrections</summary>
        <ul>
          {rules.policy.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
        <p>
          Correction review window: {rules.correctionHours} hours. Unresolved
          fixtures stay pending. Locked teams retain their original rules and
          scores.
        </p>
      </details>
    </>
  );
}

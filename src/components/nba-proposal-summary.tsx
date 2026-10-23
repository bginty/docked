import { nbaRarityWeeklyRules, nbaWeeklyLineup } from "@/core/nba-weekly";
import { scoringRows } from "@/core/scoring-release";
export function NbaProposalSummary() {
  const rules = nbaRarityWeeklyRules(),
    lineup = nbaWeeklyLineup();
  return (
    <details className="admin-workspace-panel">
      <summary>NBA weekly · Approved for protected testing</summary>
      <p>
        Eight players: PG, SG, SF, PF, C, Guard, Forward and Utility. One card
        per player. $5.2m Salary Cap or uncapped Open. Core 1.0×, Rare 1.1×,
        Elite 1.2×, Ultra Rare 1.3×, Legendary 1.4×, Icon 1.5×.
      </p>
      <p>
        Monday–Sunday in New York. All slots lock at the first included game;
        sum every eligible game. Existing NBA FLEX formats and saved rules are
        unchanged.
      </p>
      <table>
        <caption>
          Owner-approved testing points per game · Not a live release
        </caption>
        <thead>
          <tr>
            <th>Event</th>
            <th>Points</th>
          </tr>
        </thead>
        <tbody>
          {scoringRows(rules).map((r) => (
            <tr key={r.action}>
              <td>{r.action}</td>
              <td>{r.points}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p>
        Example: 28 points + 9 rebounds + 7 assists + 2 steals + 1 block − 3
        turnovers = 55.30 base points. A Legendary card contributes 77.42
        points.
      </p>
      <p>
        Rarity salaries:{" "}
        {Object.entries(lineup.salaries)
          .map(
            ([tier, amount]) =>
              `${tier.replaceAll("_", " ")}: $${amount.toLocaleString("en-AU")}`,
          )
          .join(" · ")}
        .
      </p>
      <p>
        Multiply the weekly base total, including bonuses, once using the locked
        card rarity. Earlier rounds retain their saved scoring version. More
        scheduled games can produce a substantial weekly advantage.
      </p>
      <p>
        Real-user activation remains blocked pending commercial gameplay
        approval, contracted provider rights, verified roster/positions,
        issuance approval and hosted acceptance. This review does not enable any
        gate.
      </p>
    </details>
  );
}

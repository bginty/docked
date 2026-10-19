import { nflScoringReference } from "@/core/nfl-scoring-reference";
export function NflScoringReference({
  savedWeights,
}: {
  savedWeights?: Record<string, number>;
}) {
  const rows = nflScoringReference(savedWeights),
    different = rows.some((r) => r.differs);
  return (
    <section>
      <h2>Player game-log points · Full PPR</h2>
      <p>
        These are base player points. Competition card multipliers are applied
        separately.
      </p>
      <table className="rules-rarity-table">
        <thead>
          <tr>
            <th>Statistic</th>
            <th>Base points</th>
          </tr>
        </thead>
        <tbody>
          {rows
            .filter((r) => r.base !== null)
            .map((r) => (
              <tr key={r.statistic}>
                <td>
                  {r.label} · per {r.unit}
                </td>
                <td>{r.base}</td>
              </tr>
            ))}
        </tbody>
      </table>
      {different && (
        <details>
          <summary>Saved competition scoring differs</summary>
          <p>
            This competition retains its original scoring. Its results have not
            been recalculated to match the game log.
          </p>
          <table className="rules-rarity-table">
            <thead>
              <tr>
                <th>Statistic</th>
                <th>Game log</th>
                <th>Saved competition</th>
              </tr>
            </thead>
            <tbody>
              {rows
                .filter((r) => r.differs)
                .map((r) => (
                  <tr key={r.statistic}>
                    <td>{r.label}</td>
                    <td>{r.base ?? "Not included"}</td>
                    <td>{r.saved ?? "Not included"}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </details>
      )}
    </section>
  );
}

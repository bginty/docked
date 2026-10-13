import type { MemberTestView } from "@/core/member-test-wallet";
import { limitedRarities, rarityRule } from "@/core/card-rarity";
export function EconomyOwnerReport({ state }: { state: MemberTestView }) {
  const e = state.ownerEconomy;
  if (!e || !state.ownerReport) return null;
  return (
    <section>
      <h2>Owner · card economy</h2>
      <p>
        Isolated test supply only. Immutable player/rarity definitions and
        serials; no cap or mint controls.
      </p>
      <p>
        {e.packs.length} completed pack purchases ·{" "}
        {e.supply.reduce((n, r) => n + r.issued, 0)} issued cards ·{" "}
        {
          e.players.filter(
            (p) =>
              p.status !== "active" || Date.now() - p.observedAt > 72 * 3600000,
          ).length
        }{" "}
        inactive, unknown or stale catalogue records
      </p>
      {Object.values(e.products).map((product) => {
        const draws = e.packs
          .filter((p) => p.product === product.id)
          .flatMap((p) => p.draws);
        return (
          <details key={product.id}>
            <summary>
              {product.name} · {product.version}
            </summary>
            <p>
              {product.priceCredits} test credits · {draws.length} actual
              completed draws. This small sample does not establish fairness.
            </p>
            <table>
              <thead>
                <tr>
                  <th>Rarity</th>
                  <th>Configured per draw</th>
                  <th>Observed count</th>
                </tr>
              </thead>
              <tbody>
                {limitedRarities.map((r) => (
                  <tr key={r}>
                    <td>{rarityRule(r).label}</td>
                    <td>{product.weights[r] / 100}%</td>
                    <td>{draws.filter((d) => d.rarity === r).length}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p>
              Version effective{" "}
              {new Date(product.effectiveAt).toLocaleString("en-AU", {
                timeZone: "Australia/Sydney",
              })}
              . Expires{" "}
              {product.expiresAt
                ? new Date(product.expiresAt).toLocaleString("en-AU", {
                    timeZone: "Australia/Sydney",
                  })
                : "not scheduled"}
              .
            </p>
          </details>
        );
      })}
      <h3>Purchase failures · latest 100</h3>
      {state.failures.length ? (
        <div className="economy-table">
          <table>
            <thead>
              <tr>
                <th>Time</th>
                <th>Product</th>
                <th>Category</th>
                <th>Request</th>
              </tr>
            </thead>
            <tbody>
              {state.failures.map((f, i) => (
                <tr key={i}>
                  <td>
                    {new Date(f.recordedAt).toLocaleString("en-AU", {
                      timeZone: "Australia/Sydney",
                    })}
                  </td>
                  <td>{f.product}</td>
                  <td>{f.category}</td>
                  <td>{f.request}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p>No recorded purchase failures.</p>
      )}
      <p>
        Purchases either issue nine cards and debit once, or roll back.
        Successful unopened packs are issued, not reserved. A failed database
        integrity check rejects the transaction; it never silently repairs
        supply.
      </p>
      <details>
        <summary>Pack audit references</summary>
        {e.packs.map((p) => (
          <p key={p.id}>
            {new Date(p.at).toLocaleString("en-AU", {
              timeZone: "Australia/Sydney",
            })}{" "}
            · {p.id} · configuration hash {p.configuration}
          </p>
        ))}
      </details>
    </section>
  );
}

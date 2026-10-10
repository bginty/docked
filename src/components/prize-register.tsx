import {
  prizeTotals,
  type PrizeRegister as Register,
} from "@/core/prize-register";
export function PrizeRegister({
  register = null,
  now,
  start,
  end,
}: {
  register?: Register | null;
  now: string;
  start: string;
  end: string;
}) {
  const totals = register ? prizeTotals(register, now, start, end) : null;
  return (
    <section aria-label="Prize obligations">
      <h2>Prizes owed</h2>
      <p>
        {register
          ? "SYNTHETIC TEST REGISTER — no real awards or payouts."
          : "No approved prize schedule or hosted obligation source. No automatic awards or payouts."}
      </p>
      <dl className="operations-metrics">
        <div>
          <dt>Cash owed</dt>
          <dd>
            {totals
              ? Object.entries(totals.cashByCurrency)
                  .map(([c, n]) => `${c} ${(n / 100).toFixed(2)}`)
                  .join(" · ") || "No cash obligations"
              : "Not configured"}
          </dd>
        </div>
        <div>
          <dt>Non-cash units awaiting fulfilment</dt>
          <dd>{totals?.nonCashUnits ?? "Not configured"}</dd>
        </div>
        <div>
          <dt>Overdue obligations</dt>
          <dd>{totals?.overdue ?? "Not configured"}</dd>
        </div>
        <div>
          <dt>Fulfilled in selected period</dt>
          <dd>{totals?.fulfilledInRange ?? "Not configured"}</dd>
        </div>
      </dl>
      {register?.obligations.length ? (
        <div
          className="operations-scroll"
          tabIndex={0}
          role="region"
          aria-label="Prize obligation register"
        >
          <table>
            <thead>
              <tr>
                <th>Competition / winner</th>
                <th>Reward</th>
                <th>Due</th>
                <th>Status and evidence</th>
              </tr>
            </thead>
            <tbody>
              {register.obligations.map((o) => (
                <tr key={o.id}>
                  <th>
                    {o.competition} · {o.sport} · {o.round}
                    <small>
                      #{o.position} · {o.displayName} · {o.member}
                    </small>
                  </th>
                  <td>
                    {o.description} × {o.quantity}
                    {o.kind === "cash"
                      ? ` · ${o.currency} ${(o.cents! / 100).toFixed(2)} each`
                      : ""}
                  </td>
                  <td>
                    {new Date(o.dueAt).toLocaleString("en-AU", {
                      timeZone: "Australia/Sydney",
                    })}
                    <small>Australia/Sydney</small>
                  </td>
                  <td>
                    {o.status}
                    <details>
                      <summary>Eligibility and audit</summary>
                      <p>
                        Rule {o.ruleVersion} · result revision{" "}
                        {o.resultRevision} · operator {o.operator}
                      </p>
                      <p>
                        Eligibility: {o.eligibility ? "checked" : "pending"} ·
                        verification{" "}
                        {o.verificationRequired ? "required" : "not required"}
                      </p>
                      <p>
                        {o.reason} · reference {o.reference ?? "none"} ·
                        evidence {o.evidence ?? "none"}
                      </p>
                      {register.audit
                        .filter((a) => a.result.id === o.id)
                        .map((a, i) => (
                          <p key={i}>
                            {a.at} · {a.actor} · {a.previous?.status ?? "new"} →{" "}
                            {a.result.status} · {a.reason}
                          </p>
                        ))}
                    </details>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p>No prize obligations to display.</p>
      )}
      <p>
        Cards and packs have no assigned cash value. An obligation is not wallet
        credit or a withdrawable balance.
      </p>
    </section>
  );
}

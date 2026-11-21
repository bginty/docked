import Link from "next/link";
import type { Operations } from "@/core/owner-operations";
import {
  raritySupply,
  type PublicOwnerSummary,
} from "@/core/public-owner-summary";
import { PublicOwnerSupport } from "./public-owner-support";
import { AdminIcon } from "./admin-icon";

const format = (n: number) => n.toLocaleString("en-AU");
const money = (cents: number) =>
  new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(
    cents / 100,
  );
function Trend({
  days,
  field,
  label,
}: {
  days: PublicOwnerSummary["days"];
  field: "sales" | "customers";
  label: string;
}) {
  const peak = Math.max(0, ...days.map((d) => d[field]));
  const display = field === "sales" ? money : format;
  return (
    <article className="owner-reference-panel">
      <h2>{label}</h2>
      <strong>{display(days.reduce((sum, d) => sum + d[field], 0))}</strong>
      {peak > 0 ? (
        <div className="commercial-trend" aria-hidden="true">
          {days.map((d) => (
            <span
              key={d.day}
              style={{ height: (100 * d[field]) / peak + "%" }}
              title={d.day + " · " + display(d[field])}
            />
          ))}
        </div>
      ) : (
        <p>
          {field === "sales"
            ? "No Google charges recorded in this period."
            : "No customers registered in this period."}
        </p>
      )}
      <details>
        <summary>Daily figures</summary>
        <div className="commercial-table-scroll">
          <table>
            <thead>
              <tr>
                <th>Date in Sydney</th>
                <th>{label}</th>
              </tr>
            </thead>
            <tbody>
              {days.map((d) => (
                <tr key={d.day}>
                  <td>{d.day}</td>
                  <td>{display(d[field])}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </article>
  );
}
export function PublicOwnerDashboard({
  data,
  period = "30",
}: {
  data: Operations | null;
  period?: string;
}) {
  const summary = data?.publicSummary;
  const cards = data ? raritySupply(data.inventory) : [];
  const kpis = [
    ["Commercial customers", data?.metrics.customers, "users", "blue"],
    ["Verified mobile", summary?.verified, "shield", "green"],
    ["Packs sold this period", data?.metrics.paidPacks, "pack", "purple"],
    ["Commercial cards", data?.metrics.commercialCards, "cards", "gold"],
  ] as const;
  return (
    <div className="owner-reference-dashboard commercial-owner">
      <section className="owner-welcome">
        <img src="/brand/docked/admin/three-sport-banner.webp" alt="" />
        <div>
          <h1>Commercial operations</h1>
          {data && (
            <p>
              Updated{" "}
              {new Date(data.generatedAt).toLocaleString("en-AU", {
                timeZone: "Australia/Sydney",
              })}{" "}
              Sydney
            </p>
          )}
        </div>
      </section>
      <nav className="actions" aria-label="Reporting period">
        {["7", "30", "90"].map((p) => (
          <Link
            key={p}
            className="admin-control"
            aria-current={p === period ? "page" : undefined}
            href={"/admin/operations?period=" + p}
          >
            {p} days
          </Link>
        ))}
      </nav>
      <nav className="actions" aria-label="Commercial controls">
        <Link className="admin-control" href="/admin/withdrawals">Withdrawal operations</Link>
      </nav>
      {!data && (
        <p role="alert">
          Commercial reporting is unavailable. Reload to try again.
        </p>
      )}
      <section
        className="owner-reference-kpis"
        aria-label="Commercial indicators"
      >
        {kpis.map(([label, v, icon, tone]) => (
          <article key={label} className={"owner-kpi tone-" + tone}>
            <span className="owner-kpi-icon">
              <AdminIcon name={icon} />
            </span>
            <div>
              <span>{label}</span>
              <strong>{v == null ? "Unavailable" : format(v)}</strong>
            </div>
          </article>
        ))}
      </section>
      {data && !summary && (
        <p role="alert">
          The detailed sales, registration and SMS report is unavailable. Reload
          to try again.
        </p>
      )}
      {summary && (
        <>
          <section className="owner-reference-charts">
            <Trend
              days={summary.days}
              field="sales"
              label="Gross Google credit sales"
            />
            <Trend
              days={summary.days}
              field="customers"
              label="New registrations"
            />
          </section>
          <section className="owner-reference-panel">
            <h2>Payments and refunds</h2>
            <dl className="commercial-facts">
              <div>
                <dt>Refunds recorded this period</dt>
                <dd>
                  {money(summary.days.reduce((n, d) => n + d.refunds, 0))}
                </dd>
              </div>
              <div>
                <dt>Reported tax on gross charges</dt>
                <dd>
                  {summary.chargeTax === null
                    ? "Provider amount unavailable"
                    : money(summary.chargeTax)}
                </dd>
              </div>
              <div>
                <dt>Purchased credits outstanding</dt>
                <dd>{format(summary.outstanding)}</dd>
              </div>
              <div>
                <dt>Pending receipts</dt>
                <dd>{format(summary.pending)}</dd>
              </div>
            </dl>
            <p>
              Charges include GST. Settlement and fees are reconciled
              separately.
            </p>
            <Link href="/admin/commercial-billing">
              Review billing and refunds
            </Link>
          </section>
          <section className="owner-reference-panel">
            <h2>Pack sales by sport</h2>
            {summary.packs.length ? (
              <table>
                <thead>
                  <tr>
                    <th>Sport</th>
                    <th>Pack</th>
                    <th>Sold</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.packs.map((p) => (
                    <tr key={p.sport + p.type}>
                      <td>{p.sport.toUpperCase()}</td>
                      <td>{p.type}</td>
                      <td>{format(p.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p>No paid packs recorded this period.</p>
            )}
          </section>
        </>
      )}
      {data && (
        <section className="owner-reference-panel">
          <h2>Permanent limited supply</h2>
          <div className="commercial-table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Rarity</th>
                  <th>Issued across all seasons</th>
                  <th>Commercial cards</th>
                  <th>Unissued capacity</th>
                </tr>
              </thead>
              <tbody>
                {cards.map((g) => (
                  <tr key={g.tier}>
                    <th>{g.tier.replaceAll("_", " ")}</th>
                    <td>{format(g.issued)}</td>
                    <td>{format(g.cards)}</td>
                    <td>{format(g.remaining)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p>
            Historical beta issuance consumes permanent supply. Unissued
            capacity includes dormant definitions and does not indicate sale
            availability. Core has unlimited supply.
          </p>
          <a href="/api/admin/operations?scope=live&format=csv">
            Export inventory
          </a>
        </section>
      )}
      <section className="owner-reference-panel">
        <h2>Operations</h2>
        {data && (
          <dl className="commercial-facts">
            {Object.entries({
              "Receipts under review": data.metrics.receiptsInReview,
              "Open recovery holds": data.metrics.recoveryHolds,
              "Reconciliation jobs needing attention":
                data.metrics.jobsNeedingAttention,
              "Support actions this period": summary?.support,
              "Social reports this period": summary?.moderation,
            }).map(([k, v]) => (
              <div key={k}>
                <dt>{k}</dt>
                <dd>{v == null ? "Unavailable" : format(v)}</dd>
              </div>
            ))}
          </dl>
        )}
        {summary && (
          <p>
            {summary.sms
              ? "Public SMS window · " +
                money(summary.sms.reserved) +
                " reserved · " +
                money(summary.sms.budget - summary.sms.reserved) +
                " remaining. Final provider charges require invoice reconciliation."
              : "No active public SMS budget window."}
          </p>
        )}
        {data && (
          <p>
            Credit sales {data.metrics.openSales === 1 ? "enabled" : "paused"} ·
            Pack issuance{" "}
            {data.metrics.openIssuance === 1 ? "enabled" : "paused"}
          </p>
        )}
        <nav className="actions" aria-label="Commercial support">
          <Link href="/admin/workspace/users">Customer support</Link>
          <Link href="/admin/workspace/cards">Cards and supply</Link>
          <Link href="/admin/workspace/packs">Pack receipts</Link>
          <Link href="/admin/commercial-billing">Billing and refunds</Link>
          <Link href="/admin/incidents">Operational incidents</Link>
        </nav>
      </section>
      <details className="owner-reference-panel">
        <summary>Emergency pause</summary>
        <PublicOwnerSupport />
      </details>
    </div>
  );
}

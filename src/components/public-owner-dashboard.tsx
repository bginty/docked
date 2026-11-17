import Link from "next/link";
import type { Operations } from "@/core/owner-operations";
import { PublicOwnerSupport } from "./public-owner-support";
const labels: Record<string, string> = {
  customers: "Commercial customers",
  receiptsInReview: "Receipts awaiting review",
  recoveryHolds: "Open recovery holds",
  jobsNeedingAttention: "Reconciliation jobs needing attention",
  paidPacks: "Paid packs in selected period",
  commercialCards: "Commercial cards",
  lifetimeIssued: "Lifetime limited cards issued",
  openSales: "Credit sales enabled",
  openIssuance: "Pack issuance enabled",
};
export function PublicOwnerDashboard({ data }: { data: Operations | null }) {
  return (
    <section className="panel">
      <h1>Commercial operations</h1>
      <nav className="actions" aria-label="Commercial support">
        <Link href="/admin/workspace/users">Customers</Link>
        <Link href="/admin/workspace/cards">Cards and supply</Link>
        <Link href="/admin/workspace/packs">Pack receipts</Link>
        <Link href="/admin/workspace/payments">Payment records</Link>
        <Link href="/admin/commercial-billing">Billing and refunds</Link>
        <Link href="/admin/incidents">Operational incidents</Link>
      </nav>
      {data ? (
        <>
          <p>
            Updated{" "}
            {new Date(data.generatedAt).toLocaleString("en-AU", {
              timeZone: "Australia/Sydney",
            })}{" "}
            Sydney
          </p>
          <dl>
            {Object.entries(data.metrics).map(([key, value]) => (
              <div key={key}>
                <dt>{labels[key] ?? key}</dt>
                <dd>{value.toLocaleString("en-AU")}</dd>
              </div>
            ))}
          </dl>
          {data.limitations.map((text) => (
            <p key={text}>{text}</p>
          ))}
          <a href="/api/admin/operations?scope=live&format=csv">
            Export permanent inventory supply
          </a>
        </>
      ) : (
        <p role="alert">Report unavailable. No estimated totals are shown.</p>
      )}
      <h2>Emergency pause</h2>
      <PublicOwnerSupport />
    </section>
  );
}

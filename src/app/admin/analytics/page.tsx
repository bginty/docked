import { requireRole } from "@/server/auth";
import { acquisitionMetrics } from "@/server/analytics";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Acquisition and retention",
  robots: { index: false, follow: false },
};
export default async function AnalyticsPage() {
  try {
    await requireRole(["owner", "admin", "auditor"]);
  } catch {
    return (
      <section className="section">
        <h1>Acquisition and retention</h1>
        <p>Verified administrator or auditor access with MFA is required.</p>
      </section>
    );
  }
  let metrics;
  try {
    metrics = await acquisitionMetrics();
  } catch {
    return (
      <section className="section">
        <h1>Acquisition and retention</h1>
        <p>Analytics unavailable. No measurements are inferred.</p>
      </section>
    );
  }
  return (
    <section className="section">
      <p className="eyebrow">CONSENTED MEASUREMENTS</p>
      <h1>Acquisition and retention</h1>
      <p>
        Operational account counts cover retained active accounts. Behavioural
        events cover only members who opted in; anonymous acquisition and
        deleted accounts are not reconstructed.
      </p>
      <h2>Accounts</h2>
      <pre className="safe-json">
        {JSON.stringify(metrics.accounts, null, 2)}
      </pre>
      <h2>30-day activity</h2>
      <p>
        Distinct members per event are not additive. Email opens, provider
        complaints and alert clicks remain unmeasured until an approved provider
        supplies those events.
      </p>
      <pre className="safe-json">{JSON.stringify(metrics.events, null, 2)}</pre>
      <pre className="safe-json">
        {JSON.stringify(metrics.engagement, null, 2)}
      </pre>
      <p>
        Complaint counts cover only signed webhooks received by Docked. A zero
        count with an unconfigured provider does not demonstrate zero
        complaints. Email engagement: unmeasured. Alert engagement: unmeasured.
      </p>
      <h2>7-, 30- and 90-day retention</h2>
      <p>
        A retained member has a measured content interaction in the seven-day
        window beginning on the stated day. Only completed windows enter the
        denominator. Empty cohorts have no rate.
      </p>
      <pre className="safe-json">
        {JSON.stringify(metrics.retention, null, 2)}
      </pre>
      <h2>Acquisition source</h2>
      <p>
        Unattributed means unknown; no third-party identifiers or full referring
        URLs are collected.
      </p>
      <pre className="safe-json">
        {JSON.stringify(metrics.sources, null, 2)}
      </pre>
      <h2>Delivery operations</h2>
      <pre className="safe-json">
        {JSON.stringify(metrics.delivery, null, 2)}
      </pre>
    </section>
  );
}

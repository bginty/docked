import Link from "next/link";
import { requireRole } from "@/server/auth";
import { modelDashboard } from "@/server/model-ledger";
import { AppShell } from "@/components/app-shell";
import { AppHeading } from "@/components/community-basics";
import { ModelPerformancePanel } from "@/components/model-performance-panel";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Model Performance",
  robots: { index: false, follow: false },
};
export default async function ModelPerformance({
  searchParams,
}: {
  searchParams: Promise<{ model?: string; window?: string }>;
}) {
  try {
    await requireRole(["owner", "admin", "analyst", "auditor"]);
  } catch {
    return (
      <div className="page">
        <AppHeading
          eyebrow="PRIVATE MODEL OPERATIONS"
          title="Verified staff access required"
        />
        <p>Model evidence requires a current staff role and MFA.</p>
        <Link className="button" href="/mfa">
          Verify MFA
        </Link>
      </div>
    );
  }
  const query = await searchParams;
  const modelVersion =
    typeof query.model === "string" &&
    /^football-[a-z0-9.-]{1,110}$/.test(query.model)
      ? query.model
      : undefined;
  const windowSeconds =
    typeof query.window === "string" &&
    /^\d{1,6}$/.test(query.window) &&
    Number(query.window) > 0 &&
    Number(query.window) <= 604800
      ? Number(query.window)
      : undefined;
  const data = await modelDashboard({ modelVersion, windowSeconds });
  return (
    <AppShell authenticated>
      <AppHeading
        eyebrow="PROSPECTIVE PREDICTIVE QUALITY"
        title="Model Performance"
      >
        All eligible predictions, including those that never become Edges.
      </AppHeading>
      <nav className="scanner-nav" aria-label="Model operations">
        <Link href="/admin/daily">Docked Today</Link>
        <Link href="/admin/edge-scanner">Scanner</Link>
        <Link href="/admin/candidate-edges">Candidate review</Link>
        <Link href="/admin/data-health">Data health</Link>
      </nav>
      <form className="form-stack" method="get">
        <label>
          Model version
          <select name="model" defaultValue={modelVersion ?? ""}>
            <option value="">Choose a registered model</option>
            {data.versions.map((v) => (
              <option key={v.id} value={v.id}>
                {v.id}
              </option>
            ))}
          </select>
        </label>
        <label>
          Frozen decision window (seconds before kickoff)
          <input
            name="window"
            type="number"
            min="1"
            max="604800"
            step="1"
            defaultValue={windowSeconds}
            required
          />
        </label>
        <button className="button" type="submit">
          Inspect complete cohort
        </button>
        <p>
          Choose the window in the approved policy. Different models or decision
          windows are never pooled into one score.
        </p>
      </form>
      <ModelPerformancePanel data={data} />
    </AppShell>
  );
}

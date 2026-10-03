import Link from "next/link";
import { publicTips, serviceStatus, regionAccess } from "@/server/queries";
import { EdgeCard } from "./edge-card";
import { OfficialBadge } from "./community-basics";
export async function PinnedDocked({
  timezone = "Australia/Melbourne",
  format = "decimal",
}: {
  timezone?: string;
  format?: "decimal" | "fractional" | "american";
}) {
  const [tips, status, region] = await Promise.all([
    publicTips(),
    serviceStatus(),
    regionAccess(),
  ]);
  const active = tips.filter((t) => t.display_status === "active");
  return (
    <section className="pinned-docked" aria-labelledby="pinned-docked-title">
      <div className="section-row">
        <h2 id="pinned-docked-title">DOCKED EDGES</h2>
        <Link href="/results">Complete official record</Link>
      </div>
      {active.length ? (
        <>
          <OfficialBadge />
          <div
            className="pinned-track"
            role="region"
            aria-label="Pinned official Docked Edges"
            tabIndex={0}
          >
            {active.map((t) => (
              <div className="pinned-official-item" key={t.id}>
                <EdgeCard
                  tip={t}
                  timezone={timezone}
                  format={format}
                  headingLevel={3}
                />
                <Link className="text-link" href={`/tips/${t.id}#discussion`}>
                  Comments and reactions
                </Link>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="pinned-empty">
          <OfficialBadge />
          <h3>
            {!region.allowed
              ? "Official Edges require approved regional access"
              : !status.feed
                ? "Official price monitoring is unavailable"
                : "NO DOCKED EDGE RIGHT NOW"}
          </h3>
          <p>
            {!region.allowed
              ? "Eligibility is checked against your verified account and current country/state policy. No actionable records are shown without that approval."
              : !status.feed
                ? "The data source is not ready. No successful scan or qualifying opportunity is implied."
                : "Docked only publishes when our pricing criteria are met."}
          </p>
          <div className="inline-links">
            <Link href="/results">Results, including losses</Link>
            <Link href="/methodology">Methodology</Link>
            <Link href="/sports">Monitored sports</Link>
            <Link href="/research">Research</Link>
          </div>
        </div>
      )}
    </section>
  );
}

import Link from "next/link";
import { publicTips, serviceStatus, regionAccess } from "@/server/queries";
import { EdgeCard } from "./edge-card";
import { OfficialBadge } from "./community-basics";
import { PinnedDockedEmpty } from "./pinned-docked-empty";
import { BetaReading } from "./beta-reading";
export async function PinnedDocked({
  timezone = "Australia/Melbourne",
  format = "decimal",
  compact = false,
  view = "featured",
  sport,
  competition,
  showReading = true,
}: {
  timezone?: string;
  format?: "decimal" | "fractional" | "american";
  compact?: boolean;
  view?: "featured" | "upcoming" | "recent";
  sport?: string;
  competition?: string;
  showReading?: boolean;
}) {
  const [tips, status, region] = await Promise.all([
    publicTips(),
    serviceStatus(),
    regionAccess(),
  ]);
  const active = tips.filter((t) => {
    const tipSport = t.market_rules.market.startsWith("nba_")
      ? "basketball"
      : t.market_rules.market.startsWith("football_")
        ? "football"
        : t.market_rules.market;
    return (
      (!sport || sport === tipSport) &&
      (!competition || competition === t.competition_id) &&
      (view === "recent" ||
        (view === "upcoming"
          ? t.result === "pending" &&
            new Date(t.start_at).getTime() > Date.now()
          : t.display_status === "active"))
    );
  });
  if (view === "upcoming")
    active.sort(
      (a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime(),
    );
  return (
    <section className="pinned-docked" aria-labelledby="pinned-docked-title">
      <div className="section-row">
        <h2 id="pinned-docked-title">
          {view === "upcoming"
            ? "Upcoming official records"
            : view === "recent"
              ? "Recent official records"
              : "DOCKED EDGES"}
        </h2>
        <Link href="/results">{compact ? "Official history" : "Complete official record"}</Link>
      </div>
      {active.length ? (
        <>
          <OfficialBadge />
          <div
            className={compact ? "app-feed compact-edge-list" : "pinned-track"}
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
                  compact={compact}
                />
                <Link className="text-link" href={`/tips/${t.id}#discussion`}>
                  Comments and reactions
                </Link>
              </div>
            ))}
          </div>
        </>
      ) : (
        <PinnedDockedEmpty
          compact={compact}
          regionAllowed={region.allowed}
          feedReady={status.feed}
          view={view}
        />
      )}
      {showReading && compact && !active.length && <BetaReading watchlist />}
    </section>
  );
}

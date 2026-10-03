import Link from "next/link";
import { publicTips } from "@/server/queries";
import { listCommunityEdges } from "@/server/community-edges";
import { AppShell } from "./app-shell";
import {
  AppHeading,
  CommunityEmpty,
  IntegrityNote,
  SportChips,
  OfficialBadge,
} from "./community-basics";
import { EdgeCard } from "./edge-card";
import { CommunityEdgeCard } from "./community-performance";
import { PinnedDocked } from "./pinned-docked";
export async function AppEdgeBoard({
  query,
  timezone,
  format,
}: {
  query: Record<string, string | undefined>;
  timezone: string;
  format: "decimal" | "fractional" | "american";
}) {
  const tab = ["community", "following", "settled"].includes(query.tab ?? "")
    ? query.tab!
    : "docked";
  const [official, community] = await Promise.all([
    tab === "settled" ? publicTips() : Promise.resolve([]),
    tab !== "docked"
      ? listCommunityEdges({
          sport: query.sport,
          competition: query.competition,
          following: tab === "following",
          settled: tab === "settled",
          before: query.cursor,
        })
      : Promise.resolve(null),
  ]);
  return (
    <AppShell authenticated>
      <AppHeading eyebrow="EDGE BOARD" title="Every opinion has a record.">
        Official strategy Edges and community opinions stay visibly distinct.
        Fixed units, source timestamps and complete outcomes.
      </AppHeading>
      <nav className="community-tabs" aria-label="Edge source">
        {[
          ["docked", "Docked"],
          ["community", "Community"],
          ["following", "Following"],
          ["settled", "Settled"],
        ].map(([id, label]) => (
          <Link
            key={id}
            href={`/edges?tab=${id}`}
            aria-current={id === tab ? "page" : undefined}
          >
            {label}
          </Link>
        ))}
      </nav>
      {tab === "docked" ? (
        <PinnedDocked timezone={timezone} format={format} />
      ) : (
        <>
          <SportChips
            base="/edges"
            selected={query.sport}
            query={`tab=${tab}&`}
          />
          <form className="app-form" method="get">
            <input type="hidden" name="tab" value={tab} />
            {query.sport && (
              <input type="hidden" name="sport" value={query.sport} />
            )}
            <label>
              Competition identifier
              <input
                name="competition"
                defaultValue={query.competition}
                placeholder="All approved competitions"
              />
            </label>
            <button className="button ghost">Apply filter</button>
          </form>
          {tab === "settled" &&
            official.some((t) => t.display_status === "settled") && (
              <section>
                <h2>Official Docked history</h2>
                <OfficialBadge />
                <div className="app-feed">
                  {official
                    .filter((t) => t.display_status === "settled")
                    .map((t) => (
                      <EdgeCard
                        key={t.id}
                        tip={t}
                        timezone={timezone}
                        format={format}
                      />
                    ))}
                </div>
              </section>
            )}
          <h2 className="app-section-title">
            {tab === "settled" ? "Community outcomes" : "Community Edges"}
          </h2>
          {community?.edges.length ? (
            <div className="app-feed">
              {community.edges.map((edge) => (
                <CommunityEdgeCard key={edge.id} edge={edge} />
              ))}
            </div>
          ) : (
            <CommunityEmpty title="No visible records for this view">
              {community?.message ?? "No eligible records are available."}
            </CommunityEmpty>
          )}
          {community?.nextCursor && (
            <Link
              className="button ghost"
              href={`/edges?tab=${tab}${query.sport ? `&sport=${query.sport}` : ""}${query.competition ? `&competition=${query.competition}` : ""}&cursor=${encodeURIComponent(community.nextCursor)}`}
            >
              Older records
            </Link>
          )}
        </>
      )}
      <IntegrityNote />
    </AppShell>
  );
}

import Link from "next/link";
import { AppHeading, SportChips } from "./community-basics";

export type EdgeView = "featured" | "upcoming" | "recent";
export function edgeBoardHref(
  query: Record<string, string | undefined>,
  tab: string,
  view: EdgeView,
  change: Record<string, string> = {},
) {
  return `/edges?${new URLSearchParams({ tab, view, ...(query.sport ? { sport: query.sport } : {}), ...(query.competition ? { competition: query.competition } : {}), ...change })}`;
}

/** Presentation only; status and eligibility decisions come from server read models. */
export function EdgeBoardHeader({
  query,
  tab,
  view,
  status,
}: {
  query: Record<string, string | undefined>;
  tab: string;
  view: EdgeView;
  status: { strategy: boolean; feed: boolean; publication: boolean };
}) {
  const href = (change: Record<string, string>) =>
    edgeBoardHref(query, tab, view, change);
  return (
    <>
      <AppHeading eyebrow="EDGES" title="Today's edges">
        Data. Value. Perspective.
      </AppHeading>
      <Link href="/research" className="edge-research-status">
        <span className="status-dot amber" aria-hidden="true" />
        <span>
          <strong>
            {!status.strategy
              ? "Research validation pending"
              : !status.feed
                ? "Price monitoring unavailable"
                : !status.publication
                  ? "Publication paused"
                  : "Verified monitoring"}
          </strong>
          <small>
            {!status.publication
              ? "New publications are paused."
              : "Only qualifying records are published."}
          </small>
        </span>
        <span aria-hidden="true">›</span>
      </Link>
      <nav className="community-tabs edge-view-tabs" aria-label="Edge view">
        {[
          ["featured", "Featured"],
          ["upcoming", "Upcoming"],
          ["recent", "Recent"],
        ].map(([id, label]) => (
          <Link
            key={id}
            href={href({
              view: id,
              ...(tab === "settled" && id !== "recent"
                ? { tab: "docked" }
                : {}),
            })}
            aria-current={view === id ? "page" : undefined}
          >
            {label}
          </Link>
        ))}
      </nav>
      <details
        className="edge-secondary-controls"
        open={tab !== "docked" || !!query.sport || !!query.competition}
      >
        <summary>
          Source & sport ·{" "}
          {tab === "docked"
            ? "Docked official"
            : tab === "settled"
              ? "All settled"
              : tab === "following"
                ? "Following"
                : "Community"}
        </summary>
        <nav className="community-tabs" aria-label="Edge source">
          {[
            ["docked", "Docked"],
            ["community", "Community"],
            ["following", "Following"],
            ["settled", "Settled"],
          ].map(([id, label]) => (
            <Link
              key={id}
              href={href({
                tab: id,
                ...(id === "settled" ? { view: "recent" } : {}),
              })}
              aria-current={id === tab ? "page" : undefined}
            >
              {label}
            </Link>
          ))}
        </nav>
        <SportChips
          base="/edges"
          selected={query.sport}
          query={`${new URLSearchParams({ tab, view, ...(query.competition ? { competition: query.competition } : {}) })}&`}
        />
        <form className="app-form" method="get" action="/edges">
          <input type="hidden" name="tab" value={tab} />
          <input type="hidden" name="view" value={view} />
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
      </details>
    </>
  );
}

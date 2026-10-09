import Link from "next/link";
import { OfficialBadge } from "./community-basics";
import type { EdgeView } from "./edge-board-header";

export function PinnedDockedEmpty({
  regionAllowed,
  feedReady,
  view = "featured",
  compact = false,
}: {
  regionAllowed: boolean;
  feedReady: boolean;
  view?: EdgeView;
  compact?: boolean;
}) {
  return (
    <div className={`pinned-empty${compact ? " pinned-empty--compact" : ""}`}>
      {!compact && <OfficialBadge />}
      <h3>
        {!regionAllowed
          ? compact
            ? "Official Edges need regional approval"
            : "Official Edges require approved regional access"
          : view === "recent"
            ? "No recent official records"
            : view === "upcoming"
              ? "No upcoming published records"
              : !feedReady
                ? "Official price monitoring is unavailable"
                : "NO DOCKED EDGE RIGHT NOW"}
      </h3>
      <p>
        {!regionAllowed
          ? compact
            ? "Country/state approval is required for actionable records. Preview community access does not enable official tips."
            : "Eligibility is checked against your verified account and current country/state policy. No actionable records are shown without that approval."
          : view === "recent"
            ? "The complete official record includes every published outcome. No results have been added to fill this view."
            : view === "upcoming"
              ? "Only actual, region-approved publications for future events appear here. No event or opportunity is invented."
              : !feedReady
                ? "The data source is not ready. No successful scan or qualifying opportunity is implied."
                : "Docked only publishes when our pricing criteria are met."}
      </p>
      <div className="inline-links">
        <Link href="/results">Results, including losses</Link>
        <Link href="/methodology">Methodology</Link>
        {!compact && <Link href="/sports">Monitored sports</Link>}
        {!compact && <Link href="/research">Research</Link>}
      </div>
    </div>
  );
}

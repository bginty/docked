import Link from "next/link";
import type { PublishedAnnouncement } from "@/server/member-announcements";
const labels: Record<string, string> = {
  "/fantasy/prizes": "View prizes",
  "/fantasy/play": "Build lineup",
  "/fantasy/cards": "View collection",
  "/fantasy/market": "Browse market",
  "/fantasy/results": "View Rankings",
  "/fantasy/test-wallet?view=packs": "Explore packs",
};
export function OfficialAnnouncement({
  item,
  archive = false,
  compact = false,
}: {
  item: PublishedAnnouncement;
  archive?: boolean;
  compact?: boolean;
}) {
  if (compact)
    return (
      <article
        className="official-announcement compact-announcement"
        aria-label="Official Docked announcement"
      >
        <span className="official-badge">✓ Official</span>
        <div>
          <h2>
            <Link href={`/fantasy/announcements/${item.id}`}>{item.title}</Link>
          </h2>
          <small>Latest from Docked</small>
        </div>
        <Link
          className="pack-control secondary"
          href="/fantasy/announcements"
          aria-label="View all announcements"
        >
          All updates →
        </Link>
      </article>
    );
  return (
    <article
      className={`official-announcement${compact ? " compact-announcement" : ""}`}
      aria-label="Official Docked announcement"
    >
      <header>
        <span>
          DOCKED ANNOUNCEMENTS <b>✓ Official</b>
        </span>
        {!archive && (
          <Link
            className="pack-control secondary"
            href="/fantasy/announcements"
          >
            View all announcements →
          </Link>
        )}
      </header>
      <h2>
        <Link href={`/fantasy/announcements/${item.id}`}>{item.title}</Link>
      </h2>
      {!compact && <p className="social-body">{item.body}</p>}
      <footer>
        <span>
          Posted by Docked ·{" "}
          <time dateTime={item.published_at}>
            Published{" "}
            {new Intl.DateTimeFormat("en-AU", {
              day: "numeric",
              month: "short",
              year: "numeric",
              timeZone: "Australia/Sydney",
            }).format(new Date(item.published_at))}
          </time>
          {item.edited_at && (
            <time dateTime={item.edited_at}>
              {" "}
              · Updated{" "}
              {new Intl.DateTimeFormat("en-AU", {
                timeZone: "Australia/Sydney",
                dateStyle: "medium",
              }).format(new Date(item.edited_at))}
            </time>
          )}
        </span>
        {!compact && item.cta && labels[item.cta] && (
          <Link className="pack-control primary" href={item.cta}>
            {labels[item.cta]} →
          </Link>
        )}
      </footer>
    </article>
  );
}

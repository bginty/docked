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
}: {
  item: PublishedAnnouncement;
  archive?: boolean;
}) {
  return (
    <article
      className="official-announcement"
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
      <p className="social-body">{item.body}</p>
      <footer>
        <span>
          Posted by Docked ·{" "}
          <time dateTime={item.published_at}>
            {new Intl.DateTimeFormat("en-AU", {
              day: "numeric",
              month: "short",
              year: "numeric",
              timeZone: "Australia/Sydney",
            }).format(new Date(item.published_at))}
          </time>
        </span>
        {item.cta && labels[item.cta] && (
          <Link className="pack-control primary" href={item.cta}>
            {labels[item.cta]} →
          </Link>
        )}
      </footer>
    </article>
  );
}

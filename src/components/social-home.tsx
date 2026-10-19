import Link from "next/link";
import type { CommunityFeed } from "@/core/community-social";
import { SocialComposer } from "./social-composer";
import { SocialTimeline } from "./social-timeline";
import { CommunityDirectory } from "./social-hub";
import { SocialDiscovery } from "./social-discovery";
import { socialHub } from "@/server/social-hub";
import { SocialShowcase, SocialRail } from "./social-showcase";
import { memberAnnouncements } from "@/server/member-announcements";
import { OfficialAnnouncement } from "./official-announcement";

export async function SocialHome({
  feed,
  tab,
  view,
  communityId,
  playerId,
  sport,
}: {
  feed: CommunityFeed;
  tab: "latest" | "following" | "for_you";
  view?: string;
  communityId?: string;
  playerId?: string;
  sport?: string;
}) {
  // Uses the same authorised collection projection as the member's Cards view.
  // A missing hub must not prevent reading the feed or imply an empty inventory.
  const [hub, announcements] = await Promise.all([
    feed.viewer ? socialHub().catch(() => null) : null,
    feed.viewer ? memberAnnouncements().catch(() => null) : [],
  ]);
  const announcement =
    announcements?.find((a) => a.pinned) ?? announcements?.[0];
  return (
    <section className="premium-social">
      <header className="social-hero">
        <div>
          <p className="eyebrow">THE DOCKED COMMUNITY</p>
          <h1>
            More than cards.
            <br />
            <span>A bigger game.</span>
          </h1>
          <p>Collect. Compete. Connect.</p>
          <div className="actions">
            <a className="button" href="#social-compose">
              Start a conversation
            </a>
            <Link className="button ghost" href="/fantasy/cards">
              My cards →
            </Link>
          </div>
        </div>
        <SocialShowcase cards={hub?.cards.map(({ card }) => card) ?? []} />
      </header>
      {announcement && <OfficialAnnouncement item={announcement} />}
      {announcements === null && (
        <p role="status">
          Announcements are temporarily unavailable.{" "}
          <Link href="/fantasy/announcements">Try again</Link>
        </p>
      )}
      <nav className="community-tabs" aria-label="Social sections">
        {[
          ["latest", "Home"],
          ["for_you", "For you"],
          ["following", "Following"],
          ["discover", "Discover"],
          ["communities", "Communities"],
        ].map(([key, label]) => (
          <Link
            key={key}
            href={`/fantasy/social?tab=${key}`}
            aria-current={(view ?? tab) === key ? "page" : undefined}
          >
            {label}
          </Link>
        ))}
        {feed.viewer && (
          <Link href={`/profile/${feed.viewer.handle}?tab=activity`}>
            My activity
          </Link>
        )}
      </nav>
      <div className="social-home-grid">
        <div>
          {view === "communities" ? (
            <CommunityDirectory />
          ) : view === "discover" ? (
            <SocialDiscovery suggestions={feed.profiles} />
          ) : (
            <>
              {(communityId || playerId) && (
                <div className="section-row">
                  <h2>
                    {communityId ? "Community feed" : "Player discussion"}
                  </h2>
                  <Link href="/fantasy/social">All posts</Link>
                </div>
              )}
              <div id="social-compose">
                <h2 className="social-feed-heading">What’s happening</h2>
                <SocialComposer
                  inline
                  initialSport={sport ?? "nfl"}
                  memberName={feed.viewer?.displayName}
                  memberProfile={feed.viewer}
                  communityId={communityId}
                  playerId={playerId}
                />
              </div>
              <SocialTimeline
                feed={feed}
                base="/fantasy/social"
                tab={tab}
                sport={sport}
                communityId={communityId}
                playerId={playerId}
              />
            </>
          )}
        </div>
        <aside>
          <SocialRail hub={hub} profiles={feed.profiles} />
          <section className="app-panel">
            <h2>Your next move</h2>
            <Link href="/fantasy/play">Build your lineup →</Link>
            <Link href="/fantasy/test-wallet?view=packs#packs">
              Explore packs →
            </Link>
            <Link href="/fantasy/market">Browse Market →</Link>
          </section>
          <small>Private beta · Test credits have no cash value.</small>
        </aside>
      </div>
    </section>
  );
}

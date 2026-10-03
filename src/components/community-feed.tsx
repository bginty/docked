import Link from "next/link";
import type { ReactNode } from "react";
import type { CommunityFeed } from "@/core/community-social";
import { SocialCard, ProfileActions } from "./social-interactions";
import { CommunityEmpty, OfficialBadge, SportChips } from "./community-basics";
import { SocialTimeline } from "./social-timeline";
export function FeedTabs({
  base,
  tab = "for_you",
  sport,
  compact = false,
  action,
}: {
  base: string;
  tab?: string;
  sport?: string;
  compact?: boolean;
  action?: ReactNode;
}) {
  return (
    <>
      <div className={compact ? "feed-toolbar" : undefined}>
        <nav className="community-tabs" aria-label="Community feed order">
          {[
            ["for_you", "For you"],
            ...(!compact ? [["following", "Following"]] : []),
            ["latest", "Latest"],
          ].map(([id, label]) => (
            <Link
              key={id}
              href={`${base}?tab=${id}${sport ? `&sport=${encodeURIComponent(sport)}` : ""}`}
              aria-current={tab === id ? "page" : undefined}
            >
              {label}
            </Link>
          ))}
          {!compact && (
            <>
              <Link href="/top-docked">Top Docked</Link>
              <Link href="/sports">Sports</Link>
            </>
          )}
        </nav>
        {compact && action}
      </div>
      {compact ? (
        <div className="feed-secondary-toolbar">
          <details className="feed-filters">
            <summary>Filter by sport{sport ? ` · ${sport}` : ""}</summary>
            <SportChips base={base} selected={sport} query={`tab=${tab}&`} />
          </details>
          <FeedOrder tab={tab} />
        </div>
      ) : (
        <SportChips base={base} selected={sport} query={`tab=${tab}&`} />
      )}
    </>
  );
}
function FeedOrder({
  tab,
  expanded = false,
}: {
  tab: string;
  expanded?: boolean;
}) {
  return (
    <details className="feed-explainer" open={expanded}>
      <summary>Feed order</summary>
      <p className="form-help">
        {tab === "latest"
          ? "Latest: newest visible posts first."
          : tab === "following"
            ? "Following: recent visible posts from the members you follow."
            : "For you: transparent discovery using approved content, interests and freshness. No loss, wager or chasing signals."}
      </p>
    </details>
  );
}
export function FeedContent({
  feed,
  base,
  tab,
  sport,
  compact = false,
}: {
  feed: CommunityFeed;
  base: string;
  tab: string;
  sport?: string;
  compact?: boolean;
}) {
  return (
    <>
      {!compact && <FeedOrder tab={tab} expanded />}
      {compact ? (
        <SocialTimeline
          feed={feed}
          base={base}
          tab={tab === "following" || tab === "latest" ? tab : "for_you"}
          sport={sport}
        />
      ) : feed.posts.length ? (
        <div className="app-feed">
          {feed.posts.map((post) => (
            <SocialCard key={post.id} post={post} compact={compact} />
          ))}
        </div>
      ) : (
        <CommunityEmpty
          title={
            feed.status === "ready"
              ? "A little quieter here."
              : "Community feed unavailable"
          }
        >
          {feed.status === "ready"
            ? "No visible posts match this view. Explore sports or start a conversation; Docked does not create activity to fill a feed."
            : feed.message}
        </CommunityEmpty>
      )}
      {!compact && feed.nextCursor && (
        <Link
          className="button ghost"
          href={`${base}?tab=${tab}${sport ? `&sport=${encodeURIComponent(sport)}` : ""}&cursor=${encodeURIComponent(feed.nextCursor)}`}
        >
          {compact ? "Load older posts" : "Older posts"}
        </Link>
      )}
    </>
  );
}
export function MemberDiscovery({
  profiles,
  title = "Discover members",
  explanation,
}: {
  profiles: CommunityFeed["profiles"];
  title?: string;
  explanation?: string;
}) {
  return (
    <section className="app-panel">
      <div className="section-row">
        <h2>{title}</h2>
        <Link href="/search">Search</Link>
      </div>
      {explanation && <p className="small-note">{explanation}</p>}
      {profiles.length ? (
        profiles.map((profile) => (
          <div className="discovery-member" key={profile.id}>
            <Link href={`/profile/${profile.handle}`}>
              <strong>{profile.displayName}</strong>
              <br />@{profile.handle}
              <span className="social-author-meta">
                {profile.followers} followers
              </span>
            </Link>
            {profile.isOfficial && <OfficialBadge />}
            <ProfileActions profile={profile} />
          </div>
        ))
      ) : (
        <p>
          No member suggestions are available yet. There are no invented members
          or follower counts.
        </p>
      )}
    </section>
  );
}
export function FeedSidePanel() {
  return (
    <div className="app-side-column">
      <section className="app-panel">
        <p className="eyebrow">TOP DOCKED</p>
        <h2>Records over reputation.</h2>
        <p>Verified standard units. Minimum samples. Visible losses.</p>
        <Link className="text-link" href="/top-docked">
          View the leaderboard
        </Link>
      </section>
      <section className="app-panel">
        <h2>Official evidence</h2>
        <p>Docked strategy records stay separate from community performance.</p>
        <div className="inline-links">
          <Link href="/results">Complete results</Link>
          <Link href="/research">Research status</Link>
          <Link href="/methodology">Methodology</Link>
        </div>
      </section>
      <section className="app-panel">
        <p className="eyebrow">THE READING ROOM</p>
        <h2>A better question.</h2>
        <p>
          Learn what a price implies, why sample size matters and when no
          selection is the right decision.
        </p>
        <Link className="text-link" href="/learn">
          Explore the articles
        </Link>
      </section>
    </div>
  );
}

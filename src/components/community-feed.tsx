import Link from "next/link";
import type { CommunityFeed } from "@/core/community-social";
import { SocialCard, ProfileActions } from "./social-interactions";
import { CommunityEmpty, OfficialBadge, SportChips } from "./community-basics";
export function FeedTabs({
  base,
  tab = "for_you",
  sport,
}: {
  base: string;
  tab?: string;
  sport?: string;
}) {
  return (
    <>
      <nav className="community-tabs" aria-label="Community feed order">
        {[
          ["for_you", "For you"],
          ["following", "Following"],
          ["latest", "Latest"],
        ].map(([id, label]) => (
          <Link
            key={id}
            href={`${base}?tab=${id}${sport ? `&sport=${sport}` : ""}`}
            aria-current={tab === id ? "page" : undefined}
          >
            {label}
          </Link>
        ))}
        <Link href="/top-docked">Top Docked</Link>
        <Link href="/sports">Sports</Link>
      </nav>
      <SportChips base={base} selected={sport} query={`tab=${tab}&`} />
    </>
  );
}
export function FeedContent({
  feed,
  base,
  tab,
  sport,
}: {
  feed: CommunityFeed;
  base: string;
  tab: string;
  sport?: string;
}) {
  return (
    <>
      <p className="form-help">
        {tab === "latest"
          ? "Latest: newest visible posts first."
          : tab === "following"
            ? "Following: recent visible posts from the members you follow."
            : "For you: transparent discovery using approved content, interests and freshness. No loss, wager or chasing signals."}
      </p>
      {feed.posts.length ? (
        <div className="app-feed">
          {feed.posts.map((post) => (
            <SocialCard key={post.id} post={post} />
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
      {feed.nextCursor && (
        <Link
          className="button ghost"
          href={`${base}?tab=${tab}${sport ? `&sport=${sport}` : ""}&cursor=${encodeURIComponent(feed.nextCursor)}`}
        >
          Older posts
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

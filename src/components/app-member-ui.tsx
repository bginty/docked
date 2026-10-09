import Link from "next/link";
import type { ReactNode } from "react";
import type { SocialProfile, CommunityFeed } from "@/core/community-social";
import { sports, type SportSlug } from "@/content/sports";
import { AppIcon, type AppIconName } from "./app-icon";
import { BrandLogo } from "./brand-logo";
import { AppHeading, OfficialBadge } from "./community-basics";
import { ProfileActions } from "./social-interactions";
import { SocialTimeline } from "./social-timeline";
import { SportIcon } from "./sport-icon";

export type MemberMetric = {
  label: string;
  value: string | number | null | undefined;
  note?: string;
};

/** Null is unavailable; a real recorded zero remains a zero. */
export function MemberMetrics({
  items,
  label,
}: {
  items: MemberMetric[];
  label: string;
}) {
  return (
    <dl className="member-metrics" aria-label={label}>
      {items.map((item) => (
        <div className="member-metric" key={item.label}>
          <dt className="member-metric-label">{item.label}</dt>
          <dd
            className={`member-metric-value${item.value == null ? " member-unavailable" : ""}`}
          >
            {item.value ?? "Unavailable"}
          </dd>
          {item.note && <dd className="member-metric-note">{item.note}</dd>}
        </div>
      ))}
    </dl>
  );
}

function MemberAvatar({ profile }: { profile: SocialProfile }) {
  return (
    <span className="member-avatar" aria-hidden="true">
      {profile.isOfficial ? (
        <BrandLogo variant="mark" className="brand-avatar" decorative />
      ) : profile.avatarUrl ? (
        <img src={profile.avatarUrl} width={56} height={56} alt="" />
      ) : (
        profile.displayName.slice(0, 1).toUpperCase()
      )}
    </span>
  );
}

export function MemberIdentity({ profile }: { profile: SocialProfile }) {
  return (
    <section className="member-identity" aria-label="Your community profile">
      <div className="member-row">
        <MemberAvatar profile={profile} />
        <div className="member-copy">
          <h2>{profile.displayName}</h2>
          <p>
            @{profile.handle} {profile.isOfficial && <OfficialBadge />}
          </p>
        </div>
        <Link className="button small ghost" href="/profile#edit">
          Edit profile
        </Link>
      </div>
      {profile.bio && <p className="profile-bio">{profile.bio}</p>}
      <p className="small-note">
        {profile.visibility === "private"
          ? "Private profile"
          : "Visible to eligible members"}
      </p>
      <div className="profile-counts">
        <Link href="/profile?graph=followers#connections">
          <strong>{profile.followers}</strong> followers
        </Link>
        <Link href="/following?filter=people">
          <strong>{profile.following}</strong> following
        </Link>
      </div>
    </section>
  );
}

export function MemberList({ profiles }: { profiles: SocialProfile[] }) {
  return (
    <ul className="member-list">
      {profiles.map((profile) => (
        <li className="member-row" key={profile.id}>
          <MemberAvatar profile={profile} />
          <div className="member-copy">
            <Link
              className="social-author-name"
              href={`/profile/${profile.handle}`}
            >
              {profile.displayName}
            </Link>
            <p>
              @{profile.handle} {profile.isOfficial && <OfficialBadge />}
            </p>
            <span className="small-note">{profile.followers} followers</span>
          </div>
          <ProfileActions profile={profile} />
        </li>
      ))}
    </ul>
  );
}

export function MemberEmpty({
  title,
  children,
  icon = "community",
  actions,
}: {
  title: string;
  children: ReactNode;
  icon?: AppIconName;
  actions?: ReactNode;
}) {
  return (
    <section className="member-empty">
      <span className="member-empty-icon">
        <AppIcon name={icon} size={32} />
      </span>
      <h2>{title}</h2>
      <p>{children}</p>
      {actions && <div className="actions">{actions}</div>}
    </section>
  );
}

export type FollowingMembers = {
  profiles: SocialProfile[];
  nextCursor: string | null;
  message: string;
};
export function FollowingContent({
  filter,
  sport,
  feed,
  graph,
  discovery,
}: {
  filter: "all" | "people" | "sports";
  sport?: SportSlug;
  feed: CommunityFeed;
  graph: FollowingMembers | null;
  discovery: FollowingMembers | null;
}) {
  const viewer = feed.viewer;
  const suggestions = discovery?.profiles.length
    ? discovery.profiles
    : feed.profiles;
  const heading = (
    <AppHeading eyebrow="YOUR CIRCLE" title="Following">
      Good perspectives. In one place.
    </AppHeading>
  );
  return (
    <div className="member-screen following-screen">
      {heading}
      <nav className="member-tabs" aria-label="Following view">
        {(
          [
            ["all", "All"],
            ["people", "People"],
            ["sports", "Sports"],
          ] as const
        ).map(([id, label]) => (
          <Link
            href={`/following?filter=${id}`}
            key={id}
            aria-current={filter === id ? "page" : undefined}
          >
            {label}
          </Link>
        ))}
      </nav>
      {feed.status !== "ready" ? (
        <MemberEmpty title="Following is unavailable">
          {feed.message}
        </MemberEmpty>
      ) : filter === "sports" ? (
        <section className="member-section">
          <div className="member-section-heading">
            <h2>Find your sport.</h2>
          </div>
          <p>
            Browse the sport, then join its conversations. Following a sport is
            not available yet; these links do not change your preferences.
          </p>
          <div className="member-sport-grid">
            {sports.map((item) => (
              <Link
                className="member-sport-link"
                href={`/sports/${item.slug}`}
                key={item.slug}
              >
                <SportIcon sport={item.slug} size={26} />
                <span>{item.title}</span>
                <span className="small-note">Explore</span>
              </Link>
            ))}
          </div>
          <Link className="text-link" href="/dashboard#preferences">
            Manage your existing sport preferences{" "}
            <span aria-hidden="true">→</span>
          </Link>
        </section>
      ) : (
        <>
          {!viewer ? (
            <MemberEmpty
              title="Make your circle yours."
              actions={
                <Link className="button" href="/profile">
                  Create your profile
                </Link>
              }
            >
              Choose your community identity before following people. Eligible
              official posts can still appear below.
            </MemberEmpty>
          ) : viewer.following === 0 ? (
            <MemberEmpty
              title="Follow people and explore sports"
              actions={
                <Link className="button" href="/search">
                  Find people to follow
                </Link>
              }
            >
              Follow people and official sources, or explore sports. Sport
              following is not enabled yet. Eligible official posts may still
              appear here before you follow anyone.
            </MemberEmpty>
          ) : filter === "people" ? (
            <section className="member-section">
              <div className="member-section-heading">
                <h2>People you follow</h2>
                <Link href="/search">Discover people</Link>
              </div>
              {graph?.profiles.length ? (
                <MemberList profiles={graph.profiles} />
              ) : (
                <p>
                  {graph?.message ?? "No visible relationships are available."}
                </p>
              )}
              <p className="small-note">
                Privacy and block controls determine which relationships are
                visible.
              </p>
              {graph?.nextCursor && (
                <Link
                  className="button ghost"
                  href={`/following?filter=people&graphCursor=${encodeURIComponent(graph.nextCursor)}`}
                >
                  More people
                </Link>
              )}
            </section>
          ) : null}
          {viewer?.following === 0 && (
            <section className="member-section">
              <div className="member-section-heading">
                <h2>Suggested for you</h2>
                <Link href="/search">Search</Link>
              </div>
              {suggestions.length ? (
                <MemberList profiles={suggestions} />
              ) : (
                <p>
                  No member suggestions are available yet. Explore the community
                  or browse a sport to get started.
                </p>
              )}
              <p className="small-note">
                Visible accounts to explore. Suggestions do not imply verified
                performance.
              </p>
            </section>
          )}
          {filter === "all" &&
            (feed.posts.length > 0 || (viewer?.following ?? 0) > 0) && (
              <section className="member-section member-following-feed">
                <div className="member-section-heading">
                  <h2>
                    {sport
                      ? `${sports.find((item) => item.slug === sport)?.title} conversations`
                      : "From your circle"}
                  </h2>
                  <Link href="/compose">Post</Link>
                </div>
                <p className="small-note">
                  Newest visible posts from followed people, plus eligible
                  official Docked posts. Muted accounts are excluded.
                </p>
                {sport && (
                  <Link className="text-link" href="/following">
                    Show all sports
                  </Link>
                )}
                {feed.posts.length ? (
                  <SocialTimeline
                    feed={feed}
                    base="/following"
                    tab="following"
                    sport={sport}
                  />
                ) : (
                  <MemberEmpty
                    title="Nothing new here yet."
                    icon="comment"
                    actions={
                      <Link className="text-link" href="/community?tab=latest">
                        Explore the latest conversations
                      </Link>
                    }
                  >
                    No visible posts match this view. Your feed will update when
                    an eligible new post is available.
                  </MemberEmpty>
                )}
              </section>
            )}
        </>
      )}
    </div>
  );
}

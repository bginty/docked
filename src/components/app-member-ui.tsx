import Link from "next/link";
import type { ReactNode } from "react";
import type {
  SocialProfile,
  CommunityFeed,
  CommunityStatus,
} from "@/core/community-social";
import type { CommunityPerformance } from "@/core/top-docked";
import { sports, type SportSlug } from "@/content/sports";
import type { TopDockedBoard } from "@/server/top-docked";
import { AppIcon, type AppIconName } from "./app-icon";
import { BrandLogo } from "./brand-logo";
import { AppHeading, OfficialBadge } from "./community-basics";
import { ProfileActions, ProfileEditor } from "./social-interactions";
import { SocialTimeline } from "./social-timeline";
import { SportIcon } from "./sport-icon";
import { NativeAppSettings } from "./native-bridge";
import { ApiForm } from "./forms";

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

export function MonthlyLeaderboard({ board }: { board: TopDockedBoard }) {
  const qualified = (board.status === "READY" ? board.rows : [])
    .filter((row) => row.qualification === "QUALIFIED" && row.rank !== null)
    .slice(0, 3);
  return (
    <section
      className="member-section"
      aria-labelledby="member-monthly-leaders"
    >
      <div className="member-section-heading">
        <div>
          <p className="eyebrow">TOP DOCKED · THIS MONTH</p>
          <h2 id="member-monthly-leaders">The complete record counts.</h2>
        </div>
        <AppIcon name="trophy" size={26} />
      </div>
      {qualified.length ? (
        <ol className="member-leaderboard">
          {qualified.map((row) => (
            <li className="member-row" key={row.profileId}>
              <span className="member-rank" aria-label={`Rank ${row.rank}`}>
                {row.rank}
              </span>
              <div className="member-copy">
                {row.interactionsAllowed ? (
                  <Link href={`/profile/${row.handle}`}>{row.displayName}</Link>
                ) : (
                  <strong>{row.displayName}</strong>
                )}
                <p>
                  {row.performance.won} wins · {row.performance.lost} losses ·{" "}
                  {row.performance.voids} voids
                </p>
              </div>
              <div className="member-leaderboard-result">
                <strong>
                  {row.performance.netUnits ?? "Unavailable"}
                  {row.performance.netUnits !== null ? " u" : ""}
                </strong>
                <span>
                  {row.performance.roi === null
                    ? "ROI unavailable"
                    : `${row.performance.roi}% ROI`}
                </span>
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <p className="member-unavailable">
          {board.status === "READY"
            ? "No record meets this month's sample and integrity requirements. Provisional records remain available on Top Docked."
            : board.message}
        </p>
      )}
      <p className="small-note">
        Ranked by net standardised units, not points. At least{" "}
        {board.rule.minimumSettled} non-void settled Edges across{" "}
        {board.rule.minimumActiveDays} active UTC days are required.
      </p>
      <Link className="text-link" href="/top-docked?period=month">
        All records and ranking rules <span aria-hidden="true">→</span>
      </Link>
    </section>
  );
}

const profileLinks: {
  href: string;
  label: string;
  description: string;
  icon: AppIconName;
}[] = [
  {
    href: "/profile#posts",
    label: "My posts",
    description: "Your conversations and analysis",
    icon: "comment",
  },
  {
    href: "/profile#records",
    label: "My Edges",
    description: "Permanent records, including losses",
    icon: "edge",
  },
  {
    href: "/profile?tab=saved#posts",
    label: "Saved posts",
    description: "Your private reading list",
    icon: "save",
  },
  {
    href: "/dashboard#saved",
    label: "Saved official tips",
    description: "Your bookmarked official records",
    icon: "save",
  },
  {
    href: "/following",
    label: "Following",
    description: "People and conversations you follow",
    icon: "community",
  },
  {
    href: "/notifications",
    label: "Notifications",
    description: "Your inbox and alert preferences",
    icon: "bell",
  },
  {
    href: "/dashboard",
    label: "Settings & privacy",
    description: "Preferences, export and account controls",
    icon: "settings",
  },
  {
    href: "/contact",
    label: "Help & support",
    description: "Get help with Docked",
    icon: "shield",
  },
];

export function ProfileMenu() {
  return (
    <section className="member-section">
      <h2 className="app-section-title">Your Docked</h2>
      <nav className="member-menu" aria-label="Your profile and account">
        {profileLinks.map((item) => (
          <Link className="member-menu-row" href={item.href} key={item.href}>
            <AppIcon name={item.icon} />
            <span className="member-copy">
              <strong>{item.label}</strong>
              <span>{item.description}</span>
            </span>
            <AppIcon name="arrow" size={18} />
          </Link>
        ))}
      </nav>
      <div className="member-logout">
        <ApiForm endpoint="/api/auth" action="logout" submit="Log out">
          <p className="small-note">Sign out of Docked on all devices.</p>
        </ApiForm>
      </div>
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
                <Link className="button" href="/my-edge">
                  Create your profile
                </Link>
              }
            >
              Choose your community identity before following people. Eligible
              official posts can still appear below.
            </MemberEmpty>
          ) : viewer.following === 0 ? (
            <MemberEmpty
              title="Follow people, sports and sources"
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
export function PointsContent({
  month: monthly,
  lifetime: all,
  board,
}: {
  month: CommunityPerformance | null;
  lifetime: CommunityPerformance | null;
  board: TopDockedBoard;
}) {
  const heading = (
    <AppHeading eyebrow="YOUR DOCKED" title="Your points">
      Activity. Accuracy. Progress.
    </AppHeading>
  );
  return (
    <div className="member-screen points-screen">
      {heading}
      <section
        className="member-points-card"
        aria-labelledby="points-not-launched"
      >
        <h2 id="points-not-launched" className="sr-only">
          Points summary
        </h2>
        <dl className="member-points-summary">
          <div className="member-metric">
            <dt className="member-metric-label">Monthly points</dt>
            <dd className="member-metric-value member-unavailable">
              Not enabled
            </dd>
          </div>
          <div className="member-metric">
            <dt className="member-metric-label">Lifetime points</dt>
            <dd className="member-metric-value member-unavailable">
              Not enabled
            </dd>
          </div>
        </dl>
        <p>
          Points and levels are not enabled. No rewards or balance are assigned.
        </p>
        <p className="small-note">
          Verified performance is separate. Standard units are not points.
        </p>
      </section>
      <section className="member-section" aria-labelledby="points-performance">
        <div className="member-section-heading">
          <h2 id="points-performance">Your verified record</h2>
          <Link href="/profile#performance">Full record</Link>
        </div>
        <p className="small-note">
          Community Edges only. Authorised outcomes and regional access are
          required.
        </p>
        <h3 className="member-period">This month</h3>
        <MemberMetrics
          label="Current UTC calendar month verified performance"
          items={[
            { label: "Verified Edges", value: monthly?.verifiedEdges },
            { label: "Net standard units", value: monthly?.netUnits },
            {
              label: "ROI",
              value: monthly?.roi == null ? null : `${monthly.roi}%`,
            },
          ]}
        />
        <h3 className="member-period">All time</h3>
        <MemberMetrics
          label="All available verified community history"
          items={[
            { label: "Verified Edges", value: all?.verifiedEdges },
            { label: "Net standard units", value: all?.netUnits },
            { label: "ROI", value: all?.roi == null ? null : `${all.roi}%` },
          ]}
        />
        {!monthly && !all && (
          <p className="member-unavailable">
            No accessible verified performance is available. Missing records or
            approval are not zero results.
          </p>
        )}
        <p className="small-note">
          This month uses the current UTC calendar month by submission date. All
          time covers available canonical history, including losses. ROI uses
          settled, non-void one-unit records.
        </p>
      </section>
      <MonthlyLeaderboard board={board} />
      <p className="small-note">
        Past performance does not guarantee future results.
      </p>
    </div>
  );
}
export function MyEdgeContent({
  profile,
  status,
  message,
  performance,
}: {
  profile: SocialProfile | null;
  status: CommunityStatus;
  message: string;
  performance: CommunityPerformance | null;
}) {
  const heading = (
    <AppHeading eyebrow="YOUR DOCKED" title="My Edge">
      Your profile. Your perspective.
    </AppHeading>
  );
  return (
    <div className="member-screen my-edge-screen">
      {heading}
      {profile ? (
        <MemberIdentity profile={profile} />
      ) : status === "ready" ? (
        <section className="member-section">
          <p>
            Choose the name and identity you want to share with the community.
          </p>
          <ProfileEditor profile={null} />
        </section>
      ) : (
        <MemberEmpty
          title="Your community profile is unavailable"
          actions={
            <Link className="button" href="/dashboard">
              Account settings
            </Link>
          }
        >
          {message}
        </MemberEmpty>
      )}
      {profile && (
        <section className="member-section" aria-labelledby="my-edge-record">
          <div className="member-section-heading">
            <h2 id="my-edge-record">Your record</h2>
            <Link href="/profile#performance">View all</Link>
          </div>
          <MemberMetrics
            label="All-time verified community performance"
            items={[
              { label: "Verified Edges", value: performance?.verifiedEdges },
              {
                label: "Win rate",
                value:
                  performance?.winRate == null
                    ? null
                    : `${performance.winRate}%`,
              },
              { label: "Net standard units", value: performance?.netUnits },
            ]}
          />
          <p className="small-note">
            All available verified history, including losses. Unavailable means
            no accessible evidence, not zero performance.
          </p>
        </section>
      )}
      <ProfileMenu />
      <NativeAppSettings />
    </div>
  );
}

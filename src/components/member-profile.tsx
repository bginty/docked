import Link from "next/link";
import { communityProfile } from "@/server/community-social";
import { listCommunityEdges } from "@/server/community-edges";
import { profilePerformanceBundle } from "@/server/top-docked";
import { communityGraph } from "@/server/community-discovery";
import { MemberDiscovery } from "./community-feed";
import type { RankingPeriod } from "@/core/top-docked";
import { AppShell } from "./app-shell";
import {
  AppHeading,
  AccessGate,
  CommunityEmpty,
  IntegrityNote,
  OfficialBadge,
} from "./community-basics";
import {
  ProfileActions,
  ProfileEditor,
  SocialCard,
} from "./social-interactions";
import {
  PerformanceMetrics,
  PerformanceChart,
  CommunityEdgeCard,
} from "./community-performance";
import { appViewer } from "@/server/app-view";
const periods: [RankingPeriod, string][] = [
  ["7d", "7D"],
  ["30d", "30D"],
  ["90d", "90D"],
  ["ytd", "YTD"],
  ["all", "All"],
];
export async function MemberProfile({
  handle,
  query,
}: {
  handle?: string;
  query: Record<string, string | undefined>;
}) {
  const [{ who, configured }, data] = await Promise.all([
    appViewer(),
    communityProfile(handle, {
      cursor: query.postsCursor,
      saved: query.tab === "saved",
    }),
  ]);
  const p = data.profile;
  const period = periods.some(([id]) => id === query.period)
    ? (query.period as RankingPeriod)
    : "all";
  const [performanceBundle, edges] =
    p && !p.isOfficial
      ? await Promise.all([
          profilePerformanceBundle(p.id, period),
          listCommunityEdges({ profileId: p.id, before: query.cursor }),
        ])
      : [null, null];
  const performance = performanceBundle?.performance ?? null;
  const sports = performanceBundle?.sports ?? [];
  const graphDirection =
    query.graph === "following" ? "following" : "followers";
  const graph =
    p && query.graph
      ? await communityGraph(p.id, graphDirection, query.graphCursor)
      : null;
  const base = handle ? `/profile/${handle}` : "/profile";
  return (
    <AppShell authenticated={!!who}>
      {!who ? (
        <>
          <AppHeading
            eyebrow="MEMBER PROFILE"
            title="A transparent sporting record."
          />
          <AccessGate configured={configured} />
        </>
      ) : !p ? (
        <>
          <AppHeading
            eyebrow="MY DOCKED"
            title={handle ? "Profile unavailable" : "Make yourself known."}
          />
          {!handle && data.status === "ready" ? (
            <ProfileEditor profile={null} />
          ) : (
            <CommunityEmpty title="Profile not available">
              {data.message}
            </CommunityEmpty>
          )}
        </>
      ) : (
        <>
          <section className="profile-hero">
            <div className="profile-top">
              <span className="avatar" aria-hidden="true">
                {p.avatarUrl ? (
                  <img
                    className="profile-avatar-image"
                    src={p.avatarUrl}
                    alt=""
                    width={76}
                    height={76}
                  />
                ) : (
                  p.displayName.slice(0, 1).toUpperCase()
                )}
              </span>
              <div>
                <h1>{p.displayName}</h1>
                <p>
                  @{p.handle} {p.isOfficial && <OfficialBadge />}
                </p>
                <p className="small-note">
                  Joined{" "}
                  {new Date(p.joinedAt).toLocaleDateString("en-AU", {
                    year: "numeric",
                    month: "long",
                    timeZone: "UTC",
                  })}
                </p>
              </div>
              <ProfileActions profile={p} />
            </div>
            <p className="profile-bio">{p.bio}</p>
            <div className="profile-counts">
              <Link
                href={`${base}?period=${period}&graph=followers#connections`}
              >
                <strong>{p.followers}</strong> followers
              </Link>
              <Link
                href={`${base}?period=${period}&graph=following#connections`}
              >
                <strong>{p.following}</strong> following
              </Link>
              <span>
                {p.visibility === "private"
                  ? "Private profile"
                  : "Approved member visibility"}
              </span>
            </div>
          </section>
          <nav className="community-tabs" aria-label="Profile sections">
            <a href="#performance">Performance</a>
            <a href="#records">Edges</a>
            <a href="#posts">Posts</a>
            {p.isOwn && (
              <>
                <Link href={`${base}?tab=saved#posts`}>
                  Saved community posts
                </Link>
                <Link href="/dashboard#saved">Saved official tips</Link>
                <Link href="/notifications">Notifications</Link>
                <Link href="/membership">Membership</Link>
                <Link href="/dashboard">Privacy & settings</Link>
              </>
            )}
          </nav>
          {p.isOfficial ? (
            <section className="app-panel" id="performance">
              <h2>Official Docked record</h2>
              <p>
                The system-owned account uses the canonical official strategy
                ledger. It does not compete against community members on Top
                Docked.
              </p>
              <div className="actions">
                <Link className="button" href="/results">
                  All official results
                </Link>
                <Link href="/methodology">Official methodology</Link>
              </div>
            </section>
          ) : (
            <section id="performance">
              <div className="section-row">
                <h2>Verified performance</h2>
                <Link href="/top-docked">Top Docked rules</Link>
              </div>
              <nav
                className="period-tabs"
                aria-label="Profile performance period"
              >
                {periods.map(([id, label]) => (
                  <Link
                    key={id}
                    href={`${base}?period=${id}`}
                    aria-current={id === period ? "page" : undefined}
                  >
                    {label}
                  </Link>
                ))}
              </nav>
              {performance ? (
                <p className="app-state-banner">
                  <strong>
                    {performance.qualification.replaceAll("_", " ")}
                  </strong>{" "}
                  · {performance.qualificationMessage}
                  {performance.rank && ` · Rank ${performance.rank}`}
                </p>
              ) : (
                <p className="app-state-banner">
                  No eligible performance record is available for this window.
                  No rank or performance badge has been assigned.
                </p>
              )}
              {!!performance?.badges.length && (
                <ul
                  className="badge-list"
                  aria-label="Evidence-based achievements"
                >
                  {performance.badges.map((badge) => (
                    <li key={badge.code}>
                      <span className="community-badge">{badge.label}</span>
                    </li>
                  ))}
                </ul>
              )}
              <PerformanceMetrics
                performance={performance?.performance ?? null}
              />
              <PerformanceChart
                performance={performance?.performance ?? null}
              />
              {performance && (
                <p className="small-note">
                  {performance.performance.won} wins ·{" "}
                  {performance.performance.lost} losses ·{" "}
                  {performance.performance.voids} voids ·{" "}
                  {performance.performance.pending} pending ·{" "}
                  {performance.performance.disputed} disputed/review. Settled
                  averages and ROI exclude void stakes.
                </p>
              )}
              <h3>Sport breakdown</h3>
              {sports.length ? (
                <div
                  className="table-wrap"
                  role="region"
                  aria-label="Sport performance breakdown"
                  tabIndex={0}
                >
                  <table className="leaderboard-table">
                    <caption className="small-note">
                      Same selected period and standard one-unit rules. Wins,
                      losses and pending records remain included.
                    </caption>
                    <thead>
                      <tr>
                        <th scope="col">Sport</th>
                        <th scope="col">Qualification</th>
                        <th scope="col">Net units</th>
                        <th scope="col">ROI</th>
                        <th scope="col">Won / lost / void</th>
                        <th scope="col">Pending / review</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sports.map((row) => (
                        <tr key={row.sport}>
                          <th scope="row">
                            <Link
                              href={`/top-docked?period=${period}&sport=${encodeURIComponent(row.sport)}`}
                            >
                              {row.sport}
                            </Link>
                          </th>
                          <td>
                            {row.qualification.replaceAll("_", " ")}
                            <br />
                            {row.qualificationMessage}
                            {row.badges
                              .filter((b) => b.code === "SPORT_SPECIALIST")
                              .map((b) => (
                                <p key={b.code}>{b.label}</p>
                              ))}
                          </td>
                          <td>{row.performance.netUnits ?? "N/A"}</td>
                          <td>
                            {row.performance.roi === null
                              ? "N/A"
                              : `${row.performance.roi}%`}
                          </td>
                          <td>
                            {row.performance.won} / {row.performance.lost} /{" "}
                            {row.performance.voids}
                          </td>
                          <td>
                            {row.performance.pending} /{" "}
                            {row.performance.disputed}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="small-note">
                  No eligible sport records are available for this period.
                </p>
              )}
            </section>
          )}
          {graph && (
            <section id="connections">
              <nav className="period-tabs" aria-label="Member relationships">
                <Link
                  href={`${base}?period=${period}&graph=followers#connections`}
                  aria-current={
                    graphDirection === "followers" ? "page" : undefined
                  }
                >
                  Followers
                </Link>
                <Link
                  href={`${base}?period=${period}&graph=following#connections`}
                  aria-current={
                    graphDirection === "following" ? "page" : undefined
                  }
                >
                  Following
                </Link>
              </nav>
              <MemberDiscovery
                profiles={graph.profiles}
                title={
                  graphDirection === "followers" ? "Followers" : "Following"
                }
                explanation={graph.message}
              />
              {graph.nextCursor && (
                <Link
                  className="button ghost"
                  href={`${base}?period=${period}&graph=${graphDirection}&graphCursor=${encodeURIComponent(graph.nextCursor)}#connections`}
                >
                  More connections
                </Link>
              )}
            </section>
          )}
          <section id="records">
            <div className="section-row">
              <h2>Recent Edges · all outcomes</h2>
            </div>
            {edges?.edges.length ? (
              <div className="app-feed">
                {edges.edges.map((edge) => (
                  <CommunityEdgeCard key={edge.id} edge={edge} />
                ))}
              </div>
            ) : (
              <CommunityEmpty
                title={
                  p.isOfficial
                    ? "Official history is separate"
                    : "No visible community Edges"
                }
              >
                {p.isOfficial
                  ? "Use the official results page for the complete canonical strategy record."
                  : (edges?.message ??
                    "No eligible record is available. Missing records are not zero performance.")}
              </CommunityEmpty>
            )}
            {edges?.nextCursor && (
              <Link
                className="button ghost"
                href={`${base}?period=${period}&cursor=${encodeURIComponent(edges.nextCursor)}#records`}
              >
                Older Edges
              </Link>
            )}
          </section>
          <section id="posts">
            <div className="section-row">
              <h2>
                {query.tab === "saved" && p.isOwn
                  ? "Saved community posts"
                  : "Posts and discussion"}
              </h2>
            </div>
            {data.posts.length ? (
              <div className="app-feed">
                {data.posts.map((post) => (
                  <SocialCard key={post.id} post={post} />
                ))}
              </div>
            ) : (
              <CommunityEmpty title="No visible posts">
                Social posts never enter verified performance.
              </CommunityEmpty>
            )}
            {data.nextCursor && (
              <Link
                className="button ghost"
                href={`${base}?period=${period}${query.tab === "saved" ? "&tab=saved" : ""}&postsCursor=${encodeURIComponent(data.nextCursor)}#posts`}
              >
                Older posts
              </Link>
            )}
          </section>
          <IntegrityNote />
          {p.isOwn && <ProfileEditor profile={p} />}
        </>
      )}
    </AppShell>
  );
}

import Link from "next/link";
import { communityProfile } from "@/server/community-social";
import { communityGraph } from "@/server/community-discovery";
import { MemberDiscovery } from "./community-feed";
import { AppShell } from "./app-shell";
import {
  AppHeading,
  AccessGate,
  CommunityEmpty,
  OfficialBadge,
} from "./community-basics";
import {
  ProfileActions,
  ProfileEditor,
  SocialCard,
} from "./social-interactions";
import { appViewer } from "@/server/app-view";
import { NativeShare } from "./native-share";
import { MemberAvatar } from "./member-avatar";
import { ProfileCollection } from "./social-hub";
import { PrivateOffersInbox } from "./private-card-offers";
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
  const period = "all";
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
            title="Your fantasy sports community."
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
        <div className="premium-profile">
          <section className="profile-hero">
            <div className="profile-top">
              <MemberAvatar profile={p} size={76} />
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
              <NativeShare
                path={`/profile/${p.handle}`}
                title="Docked member profile"
              />
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
            {[
              ["collection", "Collection"],
              ["teams", "Teams"],
              ["activity", "Activity"],
              ["about", "About"],
            ].map(([key, label]) => (
              <Link
                key={key}
                href={`${base}?tab=${key}`}
                aria-current={
                  (query.tab ?? "collection") === key ? "page" : undefined
                }
              >
                {label}
              </Link>
            ))}
            {p.isOwn && (
              <>
                <Link href={`${base}?tab=saved#posts`}>
                  Saved community posts
                </Link>
                <Link href="/notifications">Notifications</Link>
                <Link href={`${base}?tab=offers`}>Private offers</Link>
                <Link href="/profile/withdrawals">Withdrawals</Link>
                <Link href="/dashboard">Privacy & settings</Link>
              </>
            )}
          </nav>
          {(!query.tab || query.tab === "collection") && (
            <ProfileCollection key={p.id} handle={p.handle} />
          )}
          {query.tab === "teams" && (
            <section className="app-panel">
              <h2>Teams</h2>
              <p>
                Fantasy teams are private. Only explicitly shared team posts
                appear in Activity.
              </p>
              {p.isOwn && (
                <Link href="/fantasy/play">Manage your lineup →</Link>
              )}
            </section>
          )}
          {query.tab === "about" && (
            <section className="app-panel">
              <h2>About</h2>
              <p>{p.bio || "No bio yet."}</p>
              {p.isOwn && <ProfileEditor profile={p} />}
            </section>
          )}
          {query.tab === "offers" && p.isOwn && (
            <PrivateOffersInbox member={p.id} />
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
          {(query.tab === "activity" || query.tab === "saved") && (
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
                  Start a conversation about cards, teams or sport.
                </CommunityEmpty>
              )}
              {data.nextCursor && (
                <Link
                  className="button ghost"
                  href={`${base}?tab=${query.tab === "saved" ? "saved" : "activity"}&postsCursor=${encodeURIComponent(data.nextCursor)}#posts`}
                >
                  Older posts
                </Link>
              )}
            </section>
          )}
        </div>
      )}
    </AppShell>
  );
}

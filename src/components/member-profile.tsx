import Link from "next/link";
import { communityProfile } from "@/server/community-social";
import { communityGraph } from "@/server/community-discovery";
import { MemberDiscovery } from "./community-feed";
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
import { appViewer } from "@/server/app-view";
import { NativeShare } from "./native-share";
import { BrandLogo } from "./brand-logo";
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
        <>
          <section className="profile-hero">
            <div className="profile-top">
              <span className="avatar" aria-hidden="true">
                {p.isOfficial ? (
                  <BrandLogo
                    variant="mark"
                    className="brand-avatar"
                    decorative
                  />
                ) : p.avatarUrl ? (
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
            <a href="#posts">Posts</a>
            {p.isOwn && (
              <>
                <Link href={`${base}?tab=saved#posts`}>
                  Saved community posts
                </Link>
                <Link href="/notifications">Notifications</Link>
                <Link href="/dashboard">Privacy & settings</Link>
              </>
            )}
          </nav>
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

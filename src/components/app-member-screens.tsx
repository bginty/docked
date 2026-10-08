import { appViewer } from "@/server/app-view";
import { communityFeed, communityProfile } from "@/server/community-social";
import {
  communityGraph,
  mostFollowedMembers,
} from "@/server/community-discovery";
import { profilePerformanceBundle, topDockedBoard } from "@/server/top-docked";
import { sports } from "@/content/sports";
import { AppShell } from "./app-shell";
import { AccessGate, AppHeading } from "./community-basics";
import { MySportPosts } from "./my-sport-posts";
import {
  FollowingContent,
  MyEdgeContent,
  PointsContent,
} from "./app-member-ui";

export async function FollowingScreen({
  query,
}: {
  query: Record<string, string | undefined>;
}) {
  const { who, configured } = await appViewer();
  const filter =
    query.filter === "people" || query.filter === "sports"
      ? query.filter
      : "all";
  const sport = sports.find((item) => item.slug === query.sport)?.slug;
  if (!who)
    return (
      <AppShell authenticated={false}>
        <div className="member-screen">
          <AppHeading eyebrow="YOUR CIRCLE" title="Following">
            Good perspectives. In one place.
          </AppHeading>
          <AccessGate configured={configured} />
        </div>
      </AppShell>
    );
  const feed = await communityFeed({
    tab: "following",
    sport: filter === "all" ? sport : undefined,
    cursor: query.cursor,
  });
  const viewer = feed.viewer;
  const graph =
    viewer && filter === "people"
      ? await communityGraph(viewer.id, "following", query.graphCursor)
      : null;
  const discovery =
    feed.status === "ready" &&
    filter !== "sports" &&
    (!viewer || viewer.following === 0)
      ? await mostFollowedMembers()
      : null;
  return (
    <AppShell authenticated>
      <FollowingContent
        filter={filter}
        sport={sport}
        feed={feed}
        graph={graph}
        discovery={discovery}
      />
    </AppShell>
  );
}

export async function PointsScreen() {
  const { who, configured } = await appViewer();
  if (!who)
    return (
      <AppShell authenticated={false}>
        <div className="member-screen">
          <AppHeading eyebrow="YOUR DOCKED" title="Your points">
            Activity. Accuracy. Progress.
          </AppHeading>
          <AccessGate configured={configured} />
        </div>
      </AppShell>
    );
  const [profile, board] = await Promise.all([
    communityProfile(),
    topDockedBoard("month"),
  ]);
  const p = profile.profile;
  const [month, lifetime] =
    p?.isOwn && !p.isOfficial
      ? await Promise.all([
          profilePerformanceBundle(p.id, "month"),
          profilePerformanceBundle(p.id, "all"),
        ])
      : [null, null];
  return (
    <AppShell authenticated>
      <PointsContent
        month={month?.performance?.performance ?? null}
        lifetime={lifetime?.performance?.performance ?? null}
        board={board}
      />
    </AppShell>
  );
}

export async function MyEdgeScreen({
  query = {},
}: {
  query?: Record<string, string | undefined>;
} = {}) {
  const { who, configured } = await appViewer();
  if (!who)
    return (
      <AppShell authenticated={false}>
        <div className="member-screen">
          <AppHeading eyebrow="YOUR DOCKED" title="My Edge">
            Your profile. Your perspective.
          </AppHeading>
          <AccessGate configured={configured} />
        </div>
      </AppShell>
    );
  const data = await communityProfile();
  const profile = data.profile?.isOwn ? data.profile : null;
  const sport = sports.find((item) => item.slug === query.sport)?.slug;
  const ownPosts = profile
    ? await communityFeed({
        tab: "latest",
        author: profile.handle,
        sport,
        cursor: query.cursor,
      })
    : null;
  const bundle =
    profile && !profile.isOfficial
      ? await profilePerformanceBundle(profile.id, "all")
      : null;
  return (
    <AppShell authenticated>
      <MyEdgeContent
        profile={profile}
        status={data.status}
        message={data.message}
        performance={bundle?.performance?.performance ?? null}
      />
      {ownPosts && <MySportPosts feed={ownPosts} sport={sport} />}
    </AppShell>
  );
}

import { appViewer } from "@/server/app-view";
import { communityFeed } from "@/server/community-social";
import {
  communityGraph,
  mostFollowedMembers,
} from "@/server/community-discovery";
import { sports } from "@/content/sports";
import { AppShell } from "./app-shell";
import { AccessGate, AppHeading } from "./community-basics";
import { FollowingContent } from "./app-member-ui";

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

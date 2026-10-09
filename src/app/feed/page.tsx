import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { AppHeading, AccessGate } from "@/components/community-basics";
import {
  FeedTabs,
  FeedContent,
  FeedSidePanel,
} from "@/components/community-feed";
import { AppIcon } from "@/components/app-icon";
import { appViewer } from "@/server/app-view";
import { communityFeed } from "@/server/community-social";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Feed",
  robots: { index: false, follow: false },
};

export default async function Feed({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const query = await searchParams;
  const tab = query.tab === "latest" ? "latest" : "for_you";
  const [{ who, configured }, feed] = await Promise.all([
    appViewer(),
    communityFeed({ tab, sport: query.sport, cursor: query.cursor }),
  ]);
  return (
    <AppShell authenticated={!!who}>
      <div className="feed-screen">
        <AppHeading eyebrow="FEED" title="Your sporting perspective." />
        {who ? (
          <>
            <div className="app-columns">
              <div className="app-main-column">
                <FeedTabs
                  base="/feed"
                  tab={tab}
                  sport={query.sport}
                  compact
                  action={
                    <Link className="button feed-compose-link" href="/compose">
                      <AppIcon name="plus" size={18} /> Write post
                    </Link>
                  }
                />
                {feed.status === "ready" && !feed.viewer && (
                  <p className="app-state-banner">
                    Choose your community identity to post or follow.{" "}
                    <Link href="/profile#edit">Create your profile</Link>
                  </p>
                )}
                <FeedContent
                  feed={feed}
                  base="/feed"
                  tab={tab}
                  sport={query.sport}
                  compact
                />
              </div>
              <FeedSidePanel />
            </div>
          </>
        ) : (
          <AccessGate configured={configured} />
        )}
      </div>
    </AppShell>
  );
}

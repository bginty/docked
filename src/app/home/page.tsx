import { AppShell } from "@/components/app-shell";
import { AppHeading, AccessGate } from "@/components/community-basics";
import { PinnedDocked } from "@/components/pinned-docked";
import {
  FeedTabs,
  FeedContent,
  FeedSidePanel,
  MemberDiscovery,
} from "@/components/community-feed";
import { appViewer } from "@/server/app-view";
import { communityFeed } from "@/server/community-social";
import Link from "next/link";
import { PerformanceDiscovery } from "@/components/community-discovery";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Your Docked home",
  robots: { index: false, follow: false },
};
export default async function Home({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const q = await searchParams;
  const tab = q.tab === "latest" || q.tab === "following" ? q.tab : "for_you";
  const [{ who, configured }, feed] = await Promise.all([
    appViewer(),
    communityFeed({ tab, sport: q.sport, cursor: q.cursor }),
  ]);
  return (
    <AppShell authenticated={!!who}>
      <AppHeading eyebrow="YOUR DOCKED" title="Sport. Perspective. Evidence." />
      {who ? (
        <>
          <PinnedDocked
            timezone={who.profile.timezone}
            format={who.profile.odds_format}
          />
          {feed.status === "ready" && !feed.viewer && (
            <p className="app-state-banner">
              Choose your community identity before posting or following.{" "}
              <Link className="text-link" href="/profile">
                Create your profile
              </Link>
            </p>
          )}
          <div className="app-columns">
            <div className="app-main-column">
              <FeedTabs base="/home" tab={tab} sport={q.sport} />
              <FeedContent feed={feed} base="/home" tab={tab} sport={q.sport} />
              <PerformanceDiscovery sport={q.sport} />
              <MemberDiscovery profiles={feed.profiles} />
            </div>
            <FeedSidePanel />
          </div>
        </>
      ) : (
        <AccessGate configured={configured} />
      )}
    </AppShell>
  );
}

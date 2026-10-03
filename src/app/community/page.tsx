import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import {
  AppHeading,
  AccessGate,
  IntegrityNote,
} from "@/components/community-basics";
import {
  FeedTabs,
  FeedContent,
  FeedSidePanel,
  MemberDiscovery,
} from "@/components/community-feed";
import { appViewer } from "@/server/app-view";
import { communityFeed } from "@/server/community-social";
import { PerformanceDiscovery } from "@/components/community-discovery";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Docked community",
  robots: { index: false, follow: false },
};
export default async function Community({
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
      <AppHeading
        eyebrow="SPORTS COMMUNITY"
        title="Good discussion. Accountable records."
      >
        Share analysis, follow perspectives and see the complete evidence.
        Social conversation and verified performance remain distinct.
      </AppHeading>
      <FeedTabs base="/community" tab={tab} sport={q.sport} />
      {who ? (
        <div className="app-columns">
          <div className="app-main-column">
            <FeedContent
              feed={feed}
              base="/community"
              tab={tab}
              sport={q.sport}
            />
            <MemberDiscovery profiles={feed.profiles} />
            <PerformanceDiscovery sport={q.sport} />
          </div>
          <FeedSidePanel />
        </div>
      ) : (
        <>
          <AccessGate configured={configured} />
          <div className="grid two">
            <section className="app-panel">
              <h2>Community Edges</h2>
              <p>
                Pre-event opinions locked against a provider-observed standard
                price. Permanent records include losses and visible corrections.
              </p>
              <Link className="text-link" href="/top-docked">
                How Top Docked qualifies records
              </Link>
            </section>
            <section className="app-panel">
              <h2>Sports, without the noise.</h2>
              <p>
                Start with the sport and the rules. Explore actual research
                scope and forthcoming coverage.
              </p>
              <Link className="text-link" href="/sports">
                Explore sports
              </Link>
            </section>
          </div>
        </>
      )}
      <IntegrityNote />
    </AppShell>
  );
}

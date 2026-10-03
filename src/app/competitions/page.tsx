import { AppShell } from "@/components/app-shell";
import { AppHeading, CommunityEmpty } from "@/components/community-basics";
import { appViewer } from "@/server/app-view";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Future competitions",
  robots: { index: false, follow: false },
};
export default async function Competitions() {
  const { who } = await appViewer();
  return (
    <AppShell authenticated={!!who}>
      <AppHeading
        eyebrow="FUTURE COMPETITIONS"
        title="Sporting insight. Fair rules."
      >
        A disabled preview of the competition framework. No competitions,
        entries or prizes are available.
      </AppHeading>
      <CommunityEmpty title="Competitions and prizes are OFF">
        Activation requires jurisdiction-specific legal approval, published
        rules, eligible age and membership conditions, integrity review and
        approved prizes. Nothing on this page is an offer to enter.
      </CommunityEmpty>
      <div className="grid two">
        <section className="app-panel">
          <h2>Rules before the start</h2>
          <p>
            Future rules must fix the dates, supported sports, minimum sample,
            tie-breakers, exclusions and prize before entry.
            Verified-performance formats use standard units, never cash wagered.
          </p>
        </section>
        <section className="app-panel">
          <h2>Review before any award</h2>
          <p>
            Calculated rankings pass integrity and eligibility review.
            Disqualification needs a recorded reason. Paying for membership
            cannot improve a Top Docked ranking.
          </p>
        </section>
      </div>
      <p className="small-note">
        COMPETITIONS_ENABLED=false · PRIZES_ENABLED=false
      </p>
    </AppShell>
  );
}

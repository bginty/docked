import { AppShell } from "@/components/app-shell";
import { AppHeading, CommunityEmpty } from "@/components/community-basics";
import { appViewer } from "@/server/app-view";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Future member deals",
  robots: { index: false, follow: false },
};
export default async function Deals() {
  const { who } = await appViewer();
  return (
    <AppShell authenticated={!!who}>
      <AppHeading
        eyebrow="FUTURE MEMBER BENEFITS"
        title="Useful benefits. Independent analysis."
      >
        A disabled preview for future sports merchandise, media, tickets and
        member benefits.
      </AppHeading>
      <CommunityEmpty title="Deals and affiliates are OFF">
        There are no active sponsors, offers or affiliate links here. Every
        future offer requires reviewed eligibility, dates, terms, disclosure and
        jurisdiction approval.
      </CommunityEmpty>
      <section className="app-panel">
        <h2>Our evidence is not for sale.</h2>
        <p>
          Sponsors cannot buy tips, probability changes, verification, ranking
          positions or suppression of losing records. Betting-related offers
          need specific current legal and platform review before any activation.
        </p>
      </section>
      <p className="small-note">
        DEALS_ENABLED=false · AFFILIATES_ENABLED=false
      </p>
    </AppShell>
  );
}

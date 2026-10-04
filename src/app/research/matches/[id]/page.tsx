import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { AppHeading, AccessGate } from "@/components/community-basics";
import { appViewer } from "@/server/app-view";
import { reviewedResearch } from "@/server/research-engine";
import { MatchResearchView } from "@/components/research-file";
import { ReviewedResearchCard } from "@/components/research-content";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Reviewed match research",
  robots: { index: false, follow: false },
};
export default async function MemberResearch({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { who, configured } = await appViewer();
  if (!who)
    return (
      <AppShell authenticated={false}>
        <AppHeading eyebrow="DOCKED RESEARCH" title="Reviewed match research" />
        <AccessGate configured={configured} />
      </AppShell>
    );
  const { id } = await params;
  const valid =
    /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id);
  const data = valid
      ? await reviewedResearch({ contentId: id, limit: 1 })
      : null,
    item = data?.items[0];
  return (
    <AppShell authenticated>
      <div className="research-public">
        <AppHeading
          eyebrow="DOCKED RESEARCH · NOT AN EDGE"
          title="Reviewed sporting context"
        />
        <Link className="research-inline-link" href="/feed">
          Back to feed
        </Link>
        {item ? (
          <>
            <ReviewedResearchCard item={item} headingLevel={2} />
            <MatchResearchView file={item.file} />
          </>
        ) : (
          <section className="research-panel">
            <h2>Research is unavailable</h2>
            <p>
              This update may be unpublished, withdrawn, expired or outside your
              permitted region. No retained facts are exposed through this view.
            </p>
          </section>
        )}
      </div>
    </AppShell>
  );
}

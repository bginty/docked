import Link from "next/link";
import { requireRole } from "@/server/auth";
import { matchResearch } from "@/server/research-engine";
import { AppShell } from "@/components/app-shell";
import { AppHeading } from "@/components/community-basics";
import {
  ResearchMatchPanel,
  ResearchNavigation,
} from "@/components/research-admin";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Match research review",
  robots: { index: false, follow: false },
};
export default async function ResearchMatch({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ snapshot?: string }>;
}) {
  try {
    await requireRole(["owner", "admin", "analyst", "editor", "auditor"]);
  } catch {
    return (
      <div className="page">
        <AppHeading
          eyebrow="PRIVATE RESEARCH"
          title="Verified staff access required"
        />
        <p>Retained facts and editorial review require staff MFA.</p>
        <Link className="button" href="/mfa">
          Verify MFA
        </Link>
      </div>
    );
  }
  const { id } = await params,
    query = await searchParams;
  const snapshotId =
    typeof query.snapshot === "string" &&
    /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(
      query.snapshot,
    )
      ? query.snapshot
      : undefined;
  if (!/^[A-Za-z0-9_.:-]{1,160}$/.test(id))
    return (
      <AppShell authenticated>
        <AppHeading
          eyebrow="PRIVATE RESEARCH"
          title="Research record unavailable"
        />
      </AppShell>
    );
  const data = await matchResearch(id, undefined, snapshotId);
  return (
    <AppShell authenticated>
      <AppHeading
        eyebrow="MATCH RESEARCH FILE"
        title={
          data.event
            ? `${data.event.homeTeam} v ${data.event.awayTeam}`
            : "Research unavailable"
        }
      />
      <ResearchNavigation />
      <ResearchMatchPanel data={data} snapshotId={snapshotId} />
    </AppShell>
  );
}

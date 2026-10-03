import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { getCommunityEdge } from "@/server/community-edges";
import { appViewer } from "@/server/app-view";
import { AppShell } from "@/components/app-shell";
import {
  AppHeading,
  CommunityEmpty,
  IntegrityNote,
} from "@/components/community-basics";
import { CommunityEdgeCard } from "@/components/community-performance";
import { EdgeDiscussion } from "@/components/edge-discussion";
import { CommunityShare } from "@/components/community-share";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Permanent community Edge",
  robots: { index: false, follow: false },
};
export default async function Edge({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();
  const [{ who }, record] = await Promise.all([
    appViewer(),
    getCommunityEdge(id),
  ]);
  return (
    <AppShell authenticated={!!who}>
      <AppHeading
        eyebrow="COMMUNITY · PERMANENT RECORD"
        title="The opinion. The price. The outcome."
      />
      {record ? (
        <>
          <CommunityEdgeCard edge={record.edge} />
          <section className="app-panel">
            <h2>Verification evidence</h2>
            <dl className="edge-facts">
              <div>
                <dt>Source timestamp</dt>
                <dd>{record.edge.sourceAt}</dd>
              </div>
              <div>
                <dt>Received by Docked</dt>
                <dd>{record.edge.receivedAt}</dd>
              </div>
              <div>
                <dt>Snapshot reference</dt>
                <dd>{record.edge.snapshotId}</dd>
              </div>
              <div>
                <dt>Rule version</dt>
                <dd>{record.edge.ruleVersion}</dd>
              </div>
              <div>
                <dt>Submission cutoff</dt>
                <dd>{record.edge.cutoffAt}</dd>
              </div>
              <div>
                <dt>Settlement</dt>
                <dd>
                  {record.edge.settledAt ?? "Awaiting authorised outcome"}
                </dd>
              </div>
            </dl>
            <p>
              No member or moderator can self-settle, edit these locked fields
              or delete an underlying loss. Commentary moderation is separate.
            </p>
          </section>
          <section className="app-panel" id="corrections">
            <h2>Visible corrections</h2>
            {record.corrections.length ? (
              record.corrections.map((c) => (
                <article key={c.id}>
                  <h3>{c.type}</h3>
                  <p>{c.reason}</p>
                  <p>
                    {c.oldResult ?? "Pending"} → {c.newResult ?? "Pending"}
                  </p>
                  <p className="small-note">
                    {c.at} · Actor {c.actor} · Evidence {c.evidenceReference}
                  </p>
                </article>
              ))
            ) : (
              <p>No correction has been recorded for this Edge.</p>
            )}
          </section>
          <IntegrityNote />
          <CommunityShare id={record.edge.id} />
          {record.edge.interactionsAllowed && (
            <EdgeDiscussion communityEdgeId={id} />
          )}
          {record.edge.interactionsAllowed && (
            <Link href={`/profile/${record.edge.handle}`}>
              All of this member’s records
            </Link>
          )}
        </>
      ) : (
        <CommunityEmpty title="Record unavailable">
          This record cannot be shown under your current account, visibility or
          region permissions. No odds or performance are disclosed.
        </CommunityEmpty>
      )}
    </AppShell>
  );
}

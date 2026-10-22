import { notFound, redirect } from "next/navigation";
import { requireRole } from "@/server/auth";
import { multisportFeedHealth } from "@/server/multisport-feed-health";
import {
  multisportFeedJobs,
  retryMultisportFeedJob,
} from "@/server/multisport-feed-jobs";
import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";
import { AdminShell } from "@/components/admin-shell";
import { adminDisplayName } from "@/server/admin-display-name";
import { IngestionOperationsView } from "@/components/ingestion-operations";
import { SportReadinessPanel } from "@/components/sport-readiness-panel";
export const dynamic = "force-dynamic";
export default async function IngestionOperations({
  searchParams,
}: {
  searchParams: Promise<{ retry?: string }>;
}) {
  let who;
  try {
    who = await requireRole(["owner"]);
  } catch {
    notFound();
  }
  const health = await multisportFeedHealth();
  const jobs = health.state === "connected" ? await multisportFeedJobs() : null;
  async function retry(form: FormData) {
    "use server";
    let ok = false;
    try {
      await retryMultisportFeedJob({
        job_id: String(form.get("job_id") ?? ""),
        request_id: String(form.get("request_id") ?? ""),
        reason: String(form.get("reason") ?? ""),
      });
      ok = true;
      revalidatePath("/admin/ingestion");
    } catch {
      /* No upstream details/secrets in UI. */
    }
    redirect(`/admin/ingestion?retry=${ok ? "accepted" : "failed"}`);
  }
  const result = (await searchParams).retry;
  return (
    <AdminShell
      role={who.role}
      displayName={await adminDisplayName(who)}
      active="competitions"
    >
      <IngestionOperationsView
        health={health}
        jobs={jobs}
        retry={retry}
        requestId={randomUUID()}
        notice={
          result === "accepted"
            ? "Retry accepted. Check the job result after the next worker run."
            : result === "failed"
              ? "Retry was not confirmed. Refresh job status before retrying; owner MFA and current provider access are required."
              : undefined
        }
      />
      <SportReadinessPanel />
    </AdminShell>
  );
}

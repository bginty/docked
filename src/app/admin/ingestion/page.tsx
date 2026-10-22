import { notFound } from "next/navigation";
import { requireRole } from "@/server/auth";
import { multisportFeedHealth } from "@/server/multisport-feed-health";
import {
  multisportFeedJobs,
  retryMultisportFeedJob,
} from "@/server/multisport-feed-jobs";
import { revalidatePath } from "next/cache";

export const dynamic = "force-dynamic";
const date = (n: number | null | undefined) =>
  n == null
    ? "Not observed"
    : new Intl.DateTimeFormat("en-AU", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "Australia/Sydney",
      }).format(new Date(n * 1000));
export default async function IngestionOperations() {
  try {
    await requireRole(["owner"]);
  } catch {
    notFound();
  }
  const health = await multisportFeedHealth();
  const jobs = health.state === "connected" ? await multisportFeedJobs() : null;
  async function retry(form: FormData) {
    "use server";
    await requireRole(["owner"]);
    await retryMultisportFeedJob(String(form.get("job_id") ?? ""));
    revalidatePath("/admin/ingestion");
  }
  return (
    <section className="fantasy-panel">
      <h1>Statistics ingestion</h1>
      <p>
        Postgame statistics. Fantasy scoring remains in Docked. Times shown in
        Sydney.
      </p>
      <p>
        <a href="/admin/nfl-history">NFL feed health and history</a>
      </p>
      {jobs && (
        <details>
          <summary>Scheduled jobs and failures ({jobs.length})</summary>
          {jobs.map((job) => (
            <article key={job.id}>
              <p>
                {job.kind} · {job.state} · {date(job.due)} · attempts{" "}
                {job.attempts}
              </p>
              <p>{job.last_error ?? "No error reported"}</p>
              <form action={retry}>
                <input type="hidden" name="job_id" value={job.id} />
                <button type="submit" disabled={job.state === "running"}>
                  Retry this job
                </button>
              </form>
            </article>
          ))}
          <p>
            Retries preserve provider approval gates and cannot edit statistics
            or scoring rules.
          </p>
        </details>
      )}
      {health.state === "disabled" ? (
        <p>
          EPL, NBA, AFL and NRL monitoring is not connected. No new provider
          activation or production publishing is implied.
        </p>
      ) : health.state === "unavailable" ? (
        <p role="alert">
          Feed health is unavailable. Retained statistics have not been newly
          verified.
        </p>
      ) : (
        <>
          {health.synthetic && (
            <p role="alert">
              Synthetic testing data. Not real player statistics.
            </p>
          )}
          {health.data.map((s) => (
            <article key={s.sport}>
              <h2>{s.sport.toUpperCase()}</h2>
              <p>
                {s.provider ?? "Not configured"} · {s.activation}
              </p>
              <dl>
                <dt>Last attempt</dt>
                <dd>{date(s.last_attempt)}</dd>
                <dt>Last successful source sync</dt>
                <dd>{date(s.last_source_success)}</dd>
                <dt>Last delivery</dt>
                <dd>{date(s.last_delivery)}</dd>
                <dt>Next scheduled sync</dt>
                <dd>{date(s.next_sync)}</dd>
                <dt>Imported games / player records</dt>
                <dd>
                  {s.games_imported} / {s.player_records}
                </dd>
                <dt>Missing mappings / quarantined records</dt>
                <dd>
                  {s.missing_mappings} / {s.invalid_records}
                </dd>
                <dt>Changed records / errors / blocked jobs</dt>
                <dd>
                  {s.changed_records} / {s.errors} / {s.blocked_jobs}
                </dd>
                <dt>Scoring publication</dt>
                <dd>{s.scoring_publication}</dd>
                <dt>Latest error</dt>
                <dd>{s.last_error ?? "None reported"}</dd>
              </dl>
            </article>
          ))}
        </>
      )}
    </section>
  );
}

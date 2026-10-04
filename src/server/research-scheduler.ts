import "server-only";
import { db } from "./db";
import { config } from "./config";
import type { ReferenceSql } from "./market-reference";
import { researchPolicySchema } from "@/core/research-contracts";
import { validateResearchSource } from "@/core/research-engine";
import { phase5Hash } from "@/core/phase5-hash";
import {
  fetchResearchDataset,
  researchAdapter,
  researchDueWindow,
  researchJobKey,
  ResearchFetchError,
} from "@/core/research-scheduler";
import { recordResearchJobSnapshot } from "./research-engine";
const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : String(v));
type Job = {
  id: string;
  lease_token: string;
  payload: Record<string, unknown>;
};
async function worker(tx: ReferenceSql, job: Job) {
  await tx`select set_config('docked.research_job',${job.id},true),set_config('docked.research_lease',${job.lease_token},true)`;
  await tx`select private.research_worker(${job.id})`;
}
export async function scheduleResearchUpdates() {
  if (!config().database || process.env.RESEARCH_AUTOMATION_ENABLED !== "true")
    return { enabled: false, enqueued: 0 };
  return db().begin(async (tx) => {
    const [flag] =
      await tx`select enabled from private.feature_flags where key='research_engine' for share`;
    if (!flag?.enabled) return { enabled: false, enqueued: 0 };
    await tx`select set_config('docked.research_scheduler','true',true)`;
    const schedules =
      await tx`select s.*,p.configuration policy,v.configuration source from private.research_schedules s join private.research_policies p on p.id=s.policy_id join private.research_source_versions v on v.id=s.source_review_id where s.enabled and(s.next_run is null or s.next_run<=clock_timestamp()) order by s.next_run nulls first,s.id for update of s skip locked limit 20`;
    let enqueued = 0;
    for (const s of schedules) {
      const source = validateResearchSource(s.source),
        policy = researchPolicySchema.parse(s.policy);
      researchAdapter(source);
      const [rights] =
        await tx`select private.research_source_allowed(${s.source_review_id},'AUTOMATED_FETCH',${policy.jurisdiction}) ok`;
      if (!rights.ok) continue;
      const events =
        await tx`select * from private.events where competition_id='soccer_epl' and status='scheduled' and start_at>clock_timestamp() and start_at<=clock_timestamp()+interval '7 days' order by start_at,id limit 100`;
      const [{ now }] = await tx`select clock_timestamp() now`;
      for (const e of events) {
        const window = researchDueWindow(
          iso(e.start_at),
          iso(now),
          policy.windowsSeconds,
        );
        if (window === null) continue;
        const key = researchJobKey({
          scheduleId: String(s.id),
          eventId: String(e.id),
          startAt: iso(e.start_at),
          participants: e.participants,
          window,
        });
        const rows =
          await tx`insert into private.job_runs(dedupe_key,kind,payload)values(${key},'research-update',${tx.json({ scheduleId: String(s.id), eventId: String(e.id), startAt: iso(e.start_at), participantHash: phase5Hash(e.participants), window, origin: "scheduled" })})on conflict do nothing returning id`;
        enqueued += rows.length;
      }
      await tx`update private.research_schedules set next_run=clock_timestamp()+${source.etiquette.minimumIntervalSeconds ?? 86400}*interval '1 second' where id=${s.id}`;
    }
    return { enabled: true, enqueued };
  });
}
/** One bounded reviewed request. Reservation commits before HTTP and is never refunded after failure. */
export async function runResearchUpdate(job: Job) {
  if (process.env.RESEARCH_AUTOMATION_ENABLED !== "true")
    throw Error("RESEARCH_AUTOMATION_DISABLED");
  const prepared = await db().begin(async (tx) => {
    await worker(tx, job);
    const [s] =
      await tx`select s.*,v.configuration source,p.configuration policy from private.research_schedules s join private.research_source_versions v on v.id=s.source_review_id join private.research_policies p on p.id=s.policy_id where s.id=${String(job.payload.scheduleId)} for share of s`;
    const [e] =
      await tx`select * from private.events where id=${String(job.payload.eventId)} for share`;
    if (
      !s ||
      !e ||
      e.competition_id !== "soccer_epl" ||
      e.status !== "scheduled" ||
      iso(e.start_at) !== job.payload.startAt ||
      phase5Hash(e.participants) !== job.payload.participantHash
    )
      throw Error("EVENT_MAPPING_CHANGED");
    if (job.payload.origin === "scheduled" && !s.enabled)
      throw Error("SCHEDULE_DISABLED");
    const source = validateResearchSource(s.source),
      policy = researchPolicySchema.parse(s.policy);
    researchAdapter(source);
    const [{ now }] = await tx`select clock_timestamp() now`;
    if (Date.parse(iso(e.start_at)) <= Date.parse(iso(now)))
      throw Error("EVENT_STARTED");
    const [authority] =
      await tx`select private.research_source_allowed(${s.source_review_id},'AUTOMATED_FETCH',${policy.jurisdiction}) ok`;
    if (!authority.ok) throw Error("SOURCE_RIGHTS_UNAVAILABLE");
    const [retained] =
      await tx`select d.id,d.observed_at from private.research_dataset_snapshots d join private.research_dataset_payloads p on p.snapshot_id=d.id where d.source_review_id=${s.source_review_id} and p.retain_until>clock_timestamp() order by d.observed_at desc,d.id desc limit 1`;
    if (
      retained &&
      Date.parse(iso(retained.observed_at)) +
        (source.etiquette.minimumIntervalSeconds ?? 86400) * 1000 >
        Date.parse(iso(now))
    ) {
      const snap = await recordResearchJobSnapshot(
        tx,
        String(e.id),
        String(s.policy_id),
        job.id,
      );
      await tx`insert into private.audit_events(actor,action,subject,details)values('worker','research_dataset_reused',${job.id},${tx.json({ datasetId: String(retained.id), snapshotId: snap.id, sourceObservedAt: iso(retained.observed_at), modelStatus: "NOT_CONFIGURED" })})`;
      return { reused: true as const };
    }
    const [r] =
      await tx`insert into private.research_fetch_requests(source_review_id,job_id)values(${s.source_review_id},${job.id})returning id`;
    const [h] = retained
      ? await tx`select r.etag,r.last_modified from private.research_fetch_requests r join private.research_dataset_snapshots d on d.request_id=r.id where d.id=${retained.id}`
      : [];
    return {
      reused: false as const,
      id: String(r.id),
      eventId: String(e.id),
      policyId: String(s.policy_id),
      sourceReviewId: String(s.source_review_id),
      source,
      policy,
      etag: h?.etag ?? null,
      lastModified: h?.last_modified ?? null,
      now: iso(now),
    };
  });
  if (prepared.reused)
    return { status: "REUSED", modelStatus: "NOT_CONFIGURED" };
  try {
    const response = await fetchResearchDataset(
      {
        enabled: true,
        source: prepared.source,
        jurisdiction: prepared.policy.jurisdiction,
        now: prepared.now,
        etag: prepared.etag,
        lastModified: prepared.lastModified,
      },
      fetch,
      () => new Date().toISOString(),
    );
    return await db().begin(async (tx) => {
      await worker(tx, job);
      if (response.status === "SUCCESS") {
        const [r] =
          await tx`insert into private.research_dataset_snapshots(source_review_id,request_id,observed_at,raw_hash,payload_hash,record_count,quality)values(${prepared.sourceReviewId},${prepared.id},${response.observedAt},${response.rawHash},${phase5Hash(response.dataset)},${response.dataset.matches.length},${tx.json(response.quality)})returning id`;
        const retainUntil = new Date(
          Math.min(
            Date.parse(prepared.source.effectiveTo),
            Date.parse(response.observedAt) +
              (prepared.source.storage.maxDays ?? 0) * 86400000,
          ),
        ).toISOString();
        await tx`insert into private.research_dataset_payloads(snapshot_id,payload,retain_until)values(${r.id},${tx.json(response.dataset)},${retainUntil})`;
      }
      await tx`update private.research_fetch_requests set status=${response.status},http_status=${response.httpStatus},response_hash=${response.status === "SUCCESS" ? response.rawHash : null},etag=${response.etag},last_modified=${response.lastModified},measured=${tx.json(response.status === "SUCCESS" ? { records: response.dataset.matches.length, modelReady: false, settlementReady: false } : { notModified: true })} where id=${prepared.id}`;
      await tx`insert into private.research_source_health(source_key,last_success,etag,last_modified,circuit_until)values(${prepared.source.sourceId},clock_timestamp(),${response.etag},${response.lastModified},null)on conflict(source_key)do update set last_success=excluded.last_success,etag=coalesce(excluded.etag,private.research_source_health.etag),last_modified=coalesce(excluded.last_modified,private.research_source_health.last_modified),circuit_until=null`;
      const compiled = await recordResearchJobSnapshot(
        tx,
        prepared.eventId,
        prepared.policyId,
        job.id,
      );
      return {
        status: response.status,
        snapshotId: compiled.id,
        modelStatus: "NOT_CONFIGURED",
      };
    });
  } catch (error) {
    const safe =
      error instanceof ResearchFetchError
        ? error
        : new ResearchFetchError("SOURCE_FETCH_OR_VALIDATION_FAILED");
    await db().begin(async (tx) => {
      await worker(tx, job);
      await tx`update private.research_fetch_requests set status='FAILED',error_code=${safe.code},http_status=${safe.httpStatus},retry_after=${safe.retryAt} where id=${prepared.id} and status='RESERVED'`;
      await tx`insert into private.research_source_health(source_key,last_failure,error_code,circuit_until)values(${prepared.source.sourceId},clock_timestamp(),${safe.code},greatest(clock_timestamp()+interval '1 day',${safe.retryAt}::timestamptz))on conflict(source_key)do update set last_failure=excluded.last_failure,error_code=excluded.error_code,circuit_until=greatest(private.research_source_health.circuit_until,excluded.circuit_until)`;
    });
    throw Error(safe.code);
  }
}

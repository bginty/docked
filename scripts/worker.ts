import { db } from "../src/server/db";
import { config } from "../src/server/config";
import { leaseJob, finishJob, leaseOutbox } from "../src/server/queue";
import {
  editorialSchedules,
  dueSlot,
  dispatchDecision,
  localDay,
  nextQuietEnd,
  nextScheduleAt,
} from "../src/core/notifications";
import { eligible, type RegionPolicy } from "../src/core/policy";
import { ResendEmail } from "../src/providers/email";
import { retryIsSafe } from "../src/core/delivery";
import { prepareOutboxUnsubscribe } from "../src/server/unsubscribe-preparation";
import { processAccountDeletion } from "../src/server/account-deletion";
import { currentTip, expandPublication } from "../src/server/dispatch";
import { ingestSport, evaluateDue } from "../src/server/ingestion";
import { collectObservations } from "../src/server/observations";
import { editorialReport } from "../src/server/editorial-report";
import { drainJobs, isolatedObservation } from "../src/core/worker-runner";
import {
  processCommunityNotifications,
  purgeCommunityRetention,
} from "../src/server/community-social";
import { processLeaderboardNotifications } from "../src/server/top-docked";
const mode = process.argv[2] ?? "once";
async function main() {
  const settings = config();
  if (!settings.database) {
    console.log(
      "Worker pending: DATABASE_URL missing. No jobs or sends performed.",
    );
    return;
  }
  const sql = db();
  if (mode === "seed") {
    for (const s of editorialSchedules)
      await sql`insert into private.schedules(id,config,enabled,next_run) values(${s.key},${sql.json(s)},${s.enabled},${nextScheduleAt(s, new Date().toISOString())}) on conflict do nothing`;
    console.log("Schedules stored. Optional digests remain disabled.");
    return;
  }
  await sql`update private.outbox set state='dead',last_error='Lease exhausted after repeated crashes' where state='leased' and lease_until<now() and attempts>=5`;
  await sql`update private.job_runs set state='dead',failure_reason='Lease exhausted after repeated crashes' where state='leased' and lease_until<now() and attempts>=5`;
  const now = new Date().toISOString();
  await isolatedObservation(collectObservations, async () => {
    await sql`insert into private.audit_events(actor,action,subject,details) values('worker','observation_failure','service','{"reason":"Observation collection failed; review source/configuration"}')`;
  });
  await isolatedObservation(
    async () => {
      await purgeCommunityRetention();
      await processCommunityNotifications();
      await processLeaderboardNotifications();
    },
    async () => {
      await sql`insert into private.audit_events(actor,action,subject,details) values('worker','community_notification_failure','service','{"reason":"In-app processing failed; resumable job cursor retained"}')`;
    },
  );
  await sql.begin(async (tx) => {
    const due =
      await tx`select id from private.articles where status='scheduled' and scheduled_at<=now() and (expires_at is null or expires_at>now()) for update skip locked`;
    for (const a of due) {
      await tx`update private.articles set status='published',published_at=coalesce(published_at,now()) where id=${a.id}`;
      await tx`insert into private.audit_events(actor,action,subject) values('worker','scheduled_article_published',${a.id})`;
    }
  });
  await sql.begin(async (tx) => {
    const schedules =
      await tx`select * from private.schedules where enabled for update skip locked`;
    for (const s of schedules) {
      const schedule = { ...s.config, enabled: s.enabled };
      const due =
        s.next_run?.toISOString() ??
        nextScheduleAt(schedule, new Date(Date.now() - 60000).toISOString());
      if (due && due <= now) {
        const slot = dueSlot(schedule, due)!;
        await tx`insert into private.job_runs(dedupe_key,kind,payload) values(${slot},${s.id},${tx.json({ scheduledAt: due })}) on conflict do nothing`;
        await tx`update private.schedules set next_run=${nextScheduleAt(schedule, due)} where id=${s.id}`;
      } else if (!s.next_run)
        await tx`update private.schedules set next_run=${due} where id=${s.id}`;
    }
  });
  if (process.env.ODDS_POLLING_ENABLED === "true") {
    for (const sport of [
      "soccer_epl",
      "soccer_spain_la_liga",
      "basketball_nba",
    ])
      await sql`insert into private.job_runs(dedupe_key,kind,payload) values(${`ingest:${sport}:${Math.floor(Date.now() / 300000)}`},'ingest',${sql.json({ sport })}) on conflict do nothing`;
  }
  await drainJobs(leaseJob, async (job) => {
    const start = Date.now();
    try {
      if (job.kind === "account_deletion") {
        if (typeof job.payload.userId === "string")
          await processAccountDeletion(job.payload.userId);
      } else if (job.kind === "ingest") {
        await ingestSport(job.payload.sport);
        await evaluateDue();
      } else if (job.kind === "board-refresh") {
        const h =
          await sql`select healthy,last_success from private.source_health`;
        await sql`insert into private.audit_events(actor,action,subject,details) values('worker','board_health','service',${sql.json({ providers: h.length, fresh: h.length > 0 && h.every((x) => x.healthy && Date.now() - new Date(x.last_success).getTime() < 180000) })})`;
      } else if (["weekly-results", "monthly-report"].includes(job.kind)) {
        const id = job.dedupe_key.replaceAll(":", "-");
        const report = await editorialReport(job.kind, job.payload.scheduledAt);
        await sql`insert into private.articles(id,title,body,status) values(${id},${report.title},${report.body},'draft') on conflict do nothing`;
      } else if (["education-digest", "weekend-watchlist"].includes(job.kind)) {
        await sql`insert into private.audit_events(actor,action,subject,details) values('worker','notification_preview',${job.dedupe_key},${sql.json({ status: "draft_only", reason: "Editorial approval required before recipient expansion" })})`;
      } else throw new Error("No approved handler for job kind");
      await finishJob(job.id, job.lease_token, Date.now() - start);
      await sql`update private.schedules set last_success=now() where id=${job.kind}`;
    } catch {
      await finishJob(
        job.id,
        job.lease_token,
        Date.now() - start,
        "Job handler failed; inspect configuration without logging secrets",
      );
    }
  });
  const item = await leaseOutbox();
  if (!item) return;
  if (item.kind === "publication") {
    await expandPublication(item.id, item.payload.tipId, item.lease_token);
    return;
  }
  if (!item.user_id) {
    await sql`update private.outbox set state='suppressed',last_error='Missing recipient' where id=${item.id} and lease_token=${item.lease_token}`;
    return;
  }
  // Only real-send eligible deployments prepare a durable reservation. Preview
  // cannot reach the external adapter. A reservation survives a process crash.
  let token = "";
  if (settings.sending) {
    await sql.begin(async (tx) => {
      await tx`select pg_advisory_xact_lock(6729381)`;
      const prepared = await prepareOutboxUnsubscribe(tx, {
        outboxId: item.id,
        userId: item.user_id,
        leaseToken: item.lease_token,
        secret: process.env.UNSUBSCRIBE_SECRET ?? "",
      });
      if (!prepared) return;
      token = prepared.token;
      await tx`insert into private.delivery_attempts(outbox_id,user_id,kind,local_day,status) select ${item.id},${item.user_id},${item.kind},${localDay(new Date().toISOString(), prepared.timezone)},'reserved' where not exists(select 1 from private.delivery_attempts where outbox_id=${item.id} and status in ('reserved','sent'))`;
    });
  }
  await sql.begin(async (tx) => {
    await tx`select pg_advisory_xact_lock(6729381)`;
    // Match unsubscribe/preference lock order: recipient first, then outbox.
    await tx`select user_id from public.notification_preferences where user_id=${item.user_id} for update`;
    const locked =
      await tx`select state,lease_token,lease_until from private.outbox where id=${item.id} for update`;
    if (
      locked[0]?.state !== "leased" ||
      locked[0]?.lease_token !== item.lease_token ||
      !locked[0]?.lease_until ||
      new Date(locked[0].lease_until).getTime() <= Date.now()
    )
      return;
    const profiles =
      await tx`select p.*,n.*,u.email from public.profiles p join public.notification_preferences n on n.user_id=p.id join auth.users u on u.id=p.id where p.id=${item.user_id} and p.disabled_at is null and u.email_confirmed_at is not null for update of n`;
    const p = profiles[0];
    if (!p) {
      await tx`update private.outbox set state='suppressed',last_error='Account unavailable' where id=${item.id}`;
      return;
    }
    const flags =
      await tx`select key,enabled from private.feature_flags where key in ('sending','publication') for share`;
    const policies =
      await tx`select * from private.region_policies where country=${p.country} and state=${p.state} and effective_from<=now() and effective_to>now() order by effective_from desc limit 1`;
    const r = policies[0];
    const policy: RegionPolicy | null = r
      ? {
          country: r.country,
          state: r.state,
          effectiveFrom: r.effective_from.toISOString(),
          effectiveTo: r.effective_to.toISOString(),
          reviewAt: r.review_at.toISOString(),
          approved: r.approved,
          minimumAge: r.minimum_age,
          features: r.features,
          operators: r.operators,
          evidence: r.evidence,
          version: r.version,
        }
      : null;
    const consent =
      await tx`select granted from private.consent_events where user_id=${p.id} and purpose=${item.kind} order by created_at desc limit 1`;
    const day = localDay(new Date().toISOString(), p.timezone);
    const count =
      await tx`select count(*) from private.delivery_attempts where user_id=${p.id} and local_day=${day} and kind='edge' and status in ('sent','reserved') and outbox_id<>${item.id}`;
    const budget =
      await tx`select count(*) from private.delivery_attempts where created_at>=date_trunc('day',now()) and status in ('sent','reserved') and outbox_id<>${item.id}`;
    const attempts =
      await tx`select created_at,status from private.delivery_attempts where outbox_id=${item.id} and status in ('reserved','sent') order by created_at limit 1`;
    if (attempts[0]?.status === "sent") {
      await tx`update private.outbox set state='sent',lease_until=null where id=${item.id}`;
      return;
    }
    if (attempts[0] && !retryIsSafe(attempts[0].created_at)) {
      await tx`update private.outbox set state='dead',last_error='Provider idempotency window expired; manual reconciliation required' where id=${item.id}`;
      return;
    }
    const kind = ["edge", "digest", "education", "service"].includes(item.kind)
      ? item.kind
      : null;
    if (!kind) {
      await tx`update private.outbox set state='suppressed',last_error='Unsupported notification kind' where id=${item.id}`;
      return;
    }
    const fresh = kind === "edge" ? await currentTip(item.payload.tipId) : null;
    const dispatchNow = new Date().toISOString();
    const decision = dispatchDecision({
      now: dispatchNow,
      environment: settings.environment,
      sendingEnabled:
        settings.sending && !!flags.find((f) => f.key === "sending")?.enabled,
      consent: !!consent[0]?.granted,
      preferences: {
        timezone: p.timezone,
        paused: p.paused,
        digest: p.digest,
        edgeAlerts: p.edge_alerts,
        education: p.education,
        quietStart: p.quiet_start,
        quietEnd: p.quiet_end,
      },
      kind,
      eligible: eligible(
        policy,
        { country: p.country, state: p.state, ageAttested: p.age_attested },
        "communications",
        dispatchNow,
        fresh?.tip.pricing_model === "market_reference_v1"
          ? undefined
          : fresh?.candidate.offer.bookmaker,
      ),
      fresh: !!fresh,
      startAt: fresh?.tip.start_at.toISOString(),
      expiresAt: item.expires_at.toISOString(),
      sentToday: Number(count[0].count),
      globalBudgetRemaining: 1000 - Number(budget[0].count),
    });
    if (decision !== "send") {
      // Retain a reservation across ambiguous prior sends and quiet-hour retry.
      // Conservative budget accounting is preferable to resetting idempotency.
      if (decision === "defer_quiet_hours") {
        await tx`update private.outbox set state='queued',available_at=${nextQuietEnd(dispatchNow, p.timezone, p.quiet_end)},lease_until=null,last_error='Deferred to local quiet-hour end' where id=${item.id} and lease_token=${item.lease_token}`;
        return;
      }
      await tx`update private.outbox set state='suppressed',last_error=${decision} where id=${item.id} and lease_token=${item.lease_token}`;
      return;
    }
    if (
      !item.payload.editorialApproval ||
      !item.payload.subject ||
      !item.payload.text
    ) {
      await tx`update private.outbox set state='suppressed',last_error='Editorial evidence missing' where id=${item.id}`;
      return;
    }
    try {
      const sent = await new ResendEmail().send({
        to: p.email,
        subject: item.payload.subject,
        text: item.payload.text,
        unsubscribeUrl: `${settings.siteUrl}/api/unsubscribe?token=${token}`,
        idempotencyKey: item.dedupe_key,
      });
      await tx`update private.delivery_attempts set provider_id=${sent.id},status='sent',local_day=${day},latency_ms=${Date.now() - new Date(item.created_at).getTime()} where outbox_id=${item.id} and status='reserved'`;
      await tx`update private.outbox set state='sent',lease_until=null where id=${item.id} and lease_token=${item.lease_token}`;
    } catch {
      await tx`update private.outbox set state=case when attempts>=5 then 'dead' else 'queued' end,available_at=now()+power(2,attempts)*interval '10 seconds',last_error='Provider send failed',lease_until=null where id=${item.id} and lease_token=${item.lease_token}`;
    }
  });
}
main()
  .catch(() => {
    console.error(
      "Worker failed. Check database/configuration and operator runbook.",
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    if (process.env.DATABASE_URL) await db().end();
  });

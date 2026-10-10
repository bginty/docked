import type { Sql } from "postgres";
import { randomUUID } from "node:crypto";
import { digest, results, type ScoringState } from "../core/scoring-engine";
import {
  type FeedPermit,
  type FeedRequest,
  requireFeedPermit,
  feedRequest,
} from "./sports-feed-client";
const json = (value: unknown) => JSON.parse(JSON.stringify(value));

/** Dedicated operator connection only; no authenticated/member HTTP write route. */
export class SportsFeedStore {
  constructor(private sql: Sql) {}
  async purgeExpired() {
    const rows = await this
      .sql`update sports_feed.raw_revisions set body=null,purged_at=clock_timestamp()
      where expires_at<=clock_timestamp() and body is not null returning id`;
    return { payloadsPurged: rows.length, provenancePreserved: true };
  }
  async health() {
    return this.sql`select provider,count(*)::int jobs,
      count(*) filter(where state='blocked')::int blocked,
      count(*) filter(where state in('queued','leased'))::int pending,
      max(last_success) last_success,
      (select sum(used)::int from sports_feed.budget b where b.provider=j.provider and b.day=(clock_timestamp() at time zone 'UTC')::date) requests_today
      from sports_feed.jobs j group by provider order by provider`;
  }
  async reserveQuota(p: FeedPermit) {
    requireFeedPermit(p, p.provider, new Date());
    const r = await this
      .sql`insert into sports_feed.budget(provider,day,used) values(${p.provider},(clock_timestamp() at time zone 'UTC')::date,1)
      on conflict(provider,day) do update set used=sports_feed.budget.used+1 where sports_feed.budget.used<${p.maxRequestsPerDay} returning used`;
    if (!r.length) throw Error("Daily request budget exhausted");
  }
  async enqueue(id: string, request: FeedRequest) {
    feedRequest.parse(request);
    if (!/^[a-zA-Z0-9:_.-]{1,200}$/.test(id))
      throw Error("Invalid job identity");
    await this
      .sql`insert into sports_feed.jobs(id,provider,request) values(${id},${request.provider},${this.sql.json(request)}) on conflict do nothing`;
    const [job] = await this
      .sql`select request from sports_feed.jobs where id=${id}`;
    if (digest(job.request) !== digest(request))
      throw Error("Conflicting job identity");
  }
  async claim() {
    await this
      .sql`update sports_feed.jobs set state='blocked',error_code='RETRY_EXHAUSTED',lease=null,lease_until=null
      where state='leased' and lease_until<clock_timestamp() and attempts>=6`;
    const lease = randomUUID();
    const rows = await this
      .sql`update sports_feed.jobs set state='leased',lease=${lease},lease_until=clock_timestamp()+interval '90 seconds',attempts=attempts+1
      where id=(select id from sports_feed.jobs where attempts<6 and available_at<=clock_timestamp() and
      (state='queued' or (state='leased' and lease_until<clock_timestamp())) order by available_at,id for update skip locked limit 1)
      returning id,request,lease,attempts`;
    return rows[0] ?? null;
  }
  async fail(id: string, lease: string, blocked = false) {
    await this
      .sql`update sports_feed.jobs set state=case when ${blocked} or attempts>=6 then 'blocked' else 'queued' end,
      error_code=${blocked ? "RIGHTS_OR_CONFIGURATION" : "SOURCE_UNAVAILABLE"},
      available_at=clock_timestamp()+make_interval(secs=>least(3600,30*power(2,attempts))::int),lease=null,lease_until=null
      where id=${id} and lease=${lease} and state='leased'`;
  }
  async record(
    id: string,
    lease: string,
    payload: unknown,
    permit: FeedPermit,
    observedAt: string,
  ) {
    requireFeedPermit(permit, permit.provider, new Date());
    return this.sql.begin(async (tx) => {
      const [job] =
        await tx`select * from sports_feed.jobs where id=${id} and lease=${lease} and state='leased' and lease_until>clock_timestamp() for update`;
      if (!job || job.provider !== permit.provider)
        throw Error("Expired or mismatched feed lease");
      const at = Date.parse(observedAt);
      if (
        !Number.isFinite(at) ||
        at > Date.now() + 1000 ||
        Date.now() - at > 60000
      )
        throw Error("Invalid fetch observation");
      const resource = digest(job.request);
      await tx`update sports_feed.raw_revisions set body=null,purged_at=clock_timestamp()
        where provider=${permit.provider} and resource=${resource} and expires_at<=clock_timestamp() and body is not null`;
      await tx`insert into sports_feed.raw_revisions(provider,resource,body_hash,body,observed_at,rights_evidence,expires_at)
        values(${permit.provider},${resource},${digest(payload)},${tx.json(json(payload))},${observedAt},${permit.evidence},${observedAt}::timestamptz+make_interval(days=>${permit.rawRetentionDays})) on conflict do nothing`;
      const [raw] =
        await tx`select id from sports_feed.raw_revisions where provider=${permit.provider} and resource=${resource} and body_hash=${digest(payload)} and body is not null`;
      await tx`update sports_feed.jobs set state='done',last_success=clock_timestamp(),error_code=null,lease=null,lease_until=null where id=${id}`;
      return Number(raw.id);
    });
  }
  async create(state: ScoringState) {
    if (
      state.scope !== "authorised-free-beta" ||
      state.sources.length ||
      state.entries.length ||
      state.audits.length !== 1
    )
      throw Error("New authorised beta period required");
    await this.sql.begin(async (tx) => {
      await tx`insert into sports_feed.streams(id) values(${state.period.id})`;
      await tx`insert into sports_feed.journal(stream_id,revision,previous_hash,state_hash,body,calculated)
        values(${state.period.id},1,'',${digest(state)},${tx.json(json(state))},${tx.json(json(results(state)))})`;
    });
  }
  async change(
    id: string,
    command: (s: ScoringState) => ScoringState,
    rawId: number | null = null,
    companion: { rawId: number; fixtureId: string } | null = null,
  ) {
    return this.sql.begin(async (tx) => {
      if (
        !(
          await tx`select id from sports_feed.streams where id=${id} for update`
        ).length
      )
        throw Error("Unknown period");
      const [old] =
        await tx`select * from sports_feed.journal where stream_id=${id} order by revision desc limit 1`;
      if (digest(old.body) !== old.state_hash)
        throw Error("Scoring journal corrupt");
      const next = command(structuredClone(old.body));
      if (companion) {
        const [raw] =
          await tx`select id from sports_feed.raw_revisions where id=${companion.rawId} and provider='nflverse' and body->>'dataset'='pbp' and body is not null and expires_at>clock_timestamp()`;
        if (!raw || !rawId) throw Error("Companion provenance missing");
        await tx`insert into sports_feed.bundle_evidence(stream_id,fixture_id,weekly_raw_id,pbp_raw_id) values(${id},${companion.fixtureId},${rawId},${companion.rawId}) on conflict do nothing`;
      }
      if (digest(next) === old.state_hash) return next;
      if (
        next.scope !== "authorised-free-beta" ||
        digest(next.period) !== digest(old.body.period) ||
        next.audits.length !== old.body.audits.length + 1 ||
        digest(next.audits.slice(0, -1)) !== digest(old.body.audits) ||
        next.sources.length < old.body.sources.length ||
        digest(next.sources.slice(0, old.body.sources.length)) !==
          digest(old.body.sources) ||
        (old.body.lineupsLockedAt &&
          digest(next.entries) !== digest(old.body.entries))
      )
        throw Error("Immutable scoring evidence changed");
      if (next.sources.length > old.body.sources.length) {
        if (
          next.sources.length !== old.body.sources.length + 1 ||
          digest(next.sources.slice(0, -1)) !== digest(old.body.sources) ||
          !rawId
        )
          throw Error("Raw evidence reference required");
        const [raw] =
          await tx`select provider from sports_feed.raw_revisions where id=${rawId} and expires_at>clock_timestamp()`;
        if (!raw || raw.provider !== next.sources.at(-1)?.provider)
          throw Error("Source provenance mismatch");
      }
      await tx`insert into sports_feed.journal(stream_id,revision,previous_hash,state_hash,body,calculated,raw_id)
        values(${id},${old.revision + 1},${old.state_hash},${digest(next)},${tx.json(json(next))},${tx.json(json(results(next)))},${rawId})`;
      return next;
    }) as unknown as Promise<ScoringState>;
  }
}

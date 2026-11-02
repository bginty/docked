import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";
import type { Sql } from "postgres";

const lock = 642920261102;
/** Private bounded worker. Never deletes a financial record or purchase token.
 * Completed-job IDs remain permanently replay-safe; only operational metadata
 * is minimized. Archives have their own finite expiry and hold checks. */
export class CommercialRetention {
  constructor(
    private sql: Sql,
    private key: Buffer,
    private keyId: string,
  ) {
    if (key.length !== 32 || !/^[a-zA-Z0-9_-]{1,32}$/.test(keyId))
      throw Error("Retention key required");
  }
  private seal(value: string, id: string) {
    const iv = randomBytes(12),
      c = createCipheriv("aes-256-gcm", this.key, iv);
    c.setAAD(Buffer.from(`retention:${id}`));
    const body = Buffer.concat([c.update(value, "utf8"), c.final()]);
    return `${this.keyId}.${Buffer.concat([iv, c.getAuthTag(), body]).toString("base64")}`;
  }
  // Inspection/recovery must not resurrect a completed job or replay fulfilment.
  openArchive(payload: string, id: string, expectedDigest: string) {
    const [keyId, encoded] = payload.split(".");
    if (keyId !== this.keyId) throw Error("Archive key version unavailable");
    const b = Buffer.from(encoded, "base64"),
      c = createDecipheriv("aes-256-gcm", this.key, b.subarray(0, 12));
    c.setAAD(Buffer.from(`retention:${id}`));
    c.setAuthTag(b.subarray(12, 28));
    const data = Buffer.concat([c.update(b.subarray(28)), c.final()]).toString(
      "utf8",
    );
    if (createHash("sha256").update(data).digest("hex") !== expectedDigest)
      throw Error("Archive digest mismatch");
    return JSON.parse(data) as Record<string, unknown>;
  }
  async run(options: {
    apply?: boolean;
    expectedPolicy: string;
    limit?: number;
  }) {
    return this.sql.begin(async (transaction) => {
      const tx = transaction as unknown as Sql;
      await tx`select pg_advisory_xact_lock(${lock}::bigint)`;
      const [p] =
        await tx`select *,clock_timestamp() as server_now from billing_retention.policy where id`;
      if (!p || p.version !== options.expectedPolicy)
        throw Error("Retention policy changed");
      if (
        options.apply &&
        (!p.enabled ||
          !p.authority ||
          !p.valid_until ||
          new Date(p.valid_until) <= new Date(p.server_now))
      )
        throw Error("Retention activation required");
      const jobs =
        await tx`select * from billing_retention.candidates(${Math.min(100, Math.max(0, options.limit ?? 100))})`;
      const archives =
        await tx`select a.job_id from billing_retention.archives a where a.expires_at<clock_timestamp()
       and not billing_retention.held(a.job_id,a.receipt,a.member_id)
       and not exists(select 1 from commercial_billing.recovery_cases c where c.receipt=a.receipt and c.state='OPEN')
       and not exists(select 1 from commercial_billing.jobs j where j.receipt=a.receipt and j.state<>'done')
       order by a.expires_at,a.job_id limit 100`;
      if (options.apply) {
        for (const j of jobs) {
          // Worker owns no purchase/ownership privileges. Conditional update is
          // rechecked at mutation time and the whole archive/update commits once.
          const payload = JSON.stringify(j),
            digest = createHash("sha256").update(payload).digest("hex");
          const [r] =
            await tx`select member_id from commercial_billing.receipts where key=${j.receipt}`;
          await tx`insert into billing_retention.archives(job_id,policy_version,receipt,member_id,encrypted_payload,digest,expires_at)
           values(${j.id},${p.version},${j.receipt},${r?.member_id ?? null},${this.seal(payload, j.id)},${digest},clock_timestamp()+${p.archive_days}*interval '1 day')`;
          const changed =
            await tx`update commercial_billing.jobs set receipt=null,attempts=0,last_error=null,next_attempt_at=completed_at
           where id=${j.id} and state='done' and lease is null and lease_until is null returning id`;
          if (changed.length !== 1) throw Error("Retention source changed");
          await tx`insert into billing_retention.tombstones(job_id,policy_version) values(${j.id},${p.version})`;
          await tx`insert into billing_retention.audit(action,reference,policy_version) values('MINIMIZE_JOB',${j.id},${p.version})`;
        }
        for (const a of archives) {
          await tx`delete from billing_retention.archives where job_id=${a.job_id}`;
          await tx`insert into billing_retention.audit(action,reference,policy_version) values('PURGE_ARCHIVE',${a.job_id},${p.version})`;
        }
      }
      const [holds] =
        await tx`select count(*)::int active,count(*) filter(where review_at<clock_timestamp())::int overdue from billing_retention.holds where released_at is null`;
      return {
        mode: options.apply ? "apply" : "dry-run",
        policy: p.version,
        jobs: jobs.length,
        archives: archives.length,
        holds,
        financialRecordsChanged: 0,
        purchaseTokensChanged: 0,
      };
    });
  }
}

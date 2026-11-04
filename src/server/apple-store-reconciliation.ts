import { createHash, randomUUID } from "node:crypto";
import type { StoreTestInbox } from "./store-test-inbox";
import type {
  AppleNotice,
  AppleSandboxPurchases,
} from "./apple-store-verification";

/** Durable sandbox preparation. No hosted route or timer instantiates this until
 * Apple signing/access and the private admission/queue migration are approved.
 * Existing accounts, wallet, pack issuer and refund holds are reused unchanged. */
export class AppleTestReconciliation {
  constructor(
    private inbox: StoreTestInbox,
    private verifier: Pick<AppleSandboxPurchases, "refresh">,
    private account: (member: string) => string,
  ) {}
  async enqueue(n: AppleNotice) {
    if (
      !/^[a-f0-9]{64}$/.test(n.id) ||
      (n.receiptKey !== null && !/^\d{1,32}$/.test(n.receiptKey)) ||
      !["test", "verify", "review"].includes(n.kind) ||
      !/^[A-Z_]{1,64}$/.test(n.reason) ||
      !Number.isSafeInteger(n.occurredAt)
    )
      throw Error("Invalid Apple notification reference");
    await this.inbox.assertReady();
    const sql = this.inbox.sql,
      schema = this.inbox.reconciliationSchema;
    const rows =
      await sql`insert into ${sql(schema)}.apple_store_notifications(id,receipt_key,kind,occurred_at,reason,state,completed_at)
      values(${n.id},${n.receiptKey},${n.kind},${n.occurredAt},${n.reason},${n.kind === "test" ? "done" : n.kind === "review" ? "attention" : "pending"},${n.kind === "test" ? new Date() : null})
      on conflict do nothing returning id`;
    return rows.length === 1;
  }
  async runOne() {
    await this.inbox.assertReady();
    const sql = this.inbox.sql,
      schema = this.inbox.reconciliationSchema,
      lease = randomUUID();
    await sql`update ${sql(schema)}.apple_store_notifications set state='attention',lease=null,lease_until=null,last_error='Expired final lease; operator review required' where state='working' and lease_until<clock_timestamp() and attempts>=12`;
    const [job] =
      await sql`update ${sql(schema)}.apple_store_notifications set state='working',lease=${lease},attempts=attempts+1,lease_until=clock_timestamp()+interval '3 minutes'
      where id=(select id from ${sql(schema)}.apple_store_notifications where attempts<12 and ((state='pending' and next_attempt_at<=clock_timestamp()) or (state='working' and lease_until<clock_timestamp())) order by next_attempt_at,id for update skip locked limit 1) returning *`;
    if (!job) return false;
    try {
      const ref = await this.inbox.reference(job.receipt_key, "apple");
      if (!ref) throw Error("Await authenticated purchase binding");
      const account = this.account(ref.member);
      const receipt = await this.verifier.refresh(job.receipt_key, account);
      if (
        receipt.provider !== "apple" ||
        receipt.key !== job.receipt_key ||
        receipt.environment !== "test"
      )
        throw Error("Wrong receipt");
      await this.inbox.accept(receipt, ref.member, account, ref.token);
      await sql`update ${sql(schema)}.apple_store_notifications set state='done',completed_at=clock_timestamp(),lease=null,lease_until=null,last_error=null where id=${job.id} and lease=${lease}`;
    } catch {
      await sql`update ${sql(schema)}.apple_store_notifications set state=${job.attempts >= 12 ? "attention" : "pending"},next_attempt_at=clock_timestamp()+${Math.min(3600, 30 * 2 ** Math.min(job.attempts, 7))}*interval '1 second',lease=null,lease_until=null,last_error='Apple verification deferred; retry or operator review required' where id=${job.id} and lease=${lease}`;
    }
    return true;
  }
  /** Catch missed notifications after an outage, including already-finished
   * consumables. Bounded and repeatable; it never discovers unbound identities. */
  async schedule(bucket: string) {
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(bucket))
      throw Error("Invalid reconciliation bucket");
    await this.inbox.assertReady();
    const sql = this.inbox.sql,
      schema = this.inbox.reconciliationSchema;
    const rows =
      await sql`select receipt_key from ${sql(schema)}.store_receipts where provider='apple' and status='PURCHASED' order by updated_at,receipt_key limit 100`;
    for (const row of rows)
      await this.enqueue({
        id: createHash("sha256")
          .update(`apple-sweep:${bucket}:${row.receipt_key}`)
          .digest("hex"),
        receiptKey: row.receipt_key,
        kind: "verify",
        occurredAt: Date.now(),
        reason: "SCHEDULED",
      });
    return { scheduled: rows.length, morePossible: rows.length === 100 };
  }
  async health() {
    await this.inbox.assertReady();
    const sql = this.inbox.sql;
    return sql`select state,count(*)::int jobs,min(created_at) oldest from ${sql(this.inbox.reconciliationSchema)}.apple_store_notifications group by state order by state`;
  }
}

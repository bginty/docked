import type { StoreNotice } from "./google-store-notifications";
import type { StoreTestInbox } from "./store-test-inbox";
import type { GooglePlayTestVerifier } from "./store-purchase-verification";

/** Durable TEST-only recovery. A push is a hint, never a wallet instruction.
 * Unknown receipts cannot bind a member; only authenticated checkout does that.
 * Uses the inbox's fixed server-owned schema and role, not request parameters. */
export class StoreTestReconciliation {
  constructor(
    private inbox: StoreTestInbox,
    private verifier: Pick<GooglePlayTestVerifier, "verify" | "consume">,
    private account: (member: string) => string,
  ) {}
  async enqueue(n: StoreNotice) {
    await this.inbox.assertReady();
    const sql = this.inbox.sql,
      schema = this.inbox.reconciliationSchema;
    const rows =
      await sql`insert into ${sql(schema)}.store_notifications(id,receipt_key,kind,occurred_at,state,completed_at)
      values(${n.id},${n.receiptKey},${n.kind},${n.occurredAt},${n.kind === "test" ? "done" : "pending"},${n.kind === "test" ? new Date() : null})
      on conflict do nothing returning id`;
    return rows.length === 1;
  }
  async schedule(period: string) {
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(period))
      throw Error("Minute checkpoint required");
    await this.inbox.assertReady();
    const sql = this.inbox.sql,
      schema = this.inbox.reconciliationSchema;
    // Bound each sweep and revisit the least recently scheduled receipts first.
    // A duplicate tick does not create another job; a pending job is not piled up.
    return sql`insert into ${sql(schema)}.store_notifications(id,receipt_key,kind,occurred_at)
      select ${period} || ':' || r.receipt_key,r.receipt_key,'scheduled',floor(extract(epoch from clock_timestamp())*1000)::bigint
      from ${sql(schema)}.store_receipts r
      where r.provider='google' and r.status in ('PENDING','PURCHASED')
      and not exists(select 1 from ${sql(schema)}.store_notifications n where n.receipt_key=r.receipt_key and n.state in ('pending','working'))
      order by coalesce((select max(n.created_at) from ${sql(schema)}.store_notifications n where n.receipt_key=r.receipt_key),r.updated_at),r.receipt_key
      limit 100 on conflict do nothing returning id`;
  }
  async runOne() {
    await this.inbox.assertReady();
    const sql = this.inbox.sql,
      schema = this.inbox.reconciliationSchema;
    const [job] =
      await sql`update ${sql(schema)}.store_notifications set state='working',attempts=attempts+1,lease_until=clock_timestamp()+interval '60 seconds'
      where id=(select id from ${sql(schema)}.store_notifications where (state='pending' and next_attempt_at<=clock_timestamp()) or (state='working' and lease_until<clock_timestamp()) order by next_attempt_at,id for update skip locked limit 1) returning *`;
    if (!job) return false;
    try {
      const ref = await this.inbox.reference(job.receipt_key);
      if (!ref) throw Error("Receipt not bound");
      const account = this.account(ref.member);
      const receipt = await this.verifier.verify(ref.token, account);
      if (receipt.key !== job.receipt_key) throw Error("Receipt key mismatch");
      await this.inbox.accept(receipt, ref.member, account, ref.token);
      await sql`update ${sql(schema)}.store_notifications set state='done',completed_at=clock_timestamp(),lease_until=null,last_error=null where id=${job.id} and state='working' and attempts=${job.attempts}`;
      return true;
    } catch {
      await sql`update ${sql(schema)}.store_notifications
        set state=case when attempts>=12 then 'attention' else 'pending' end,lease_until=null,
        next_attempt_at=clock_timestamp()+least(3600,30*power(2,least(attempts,7)))*interval '1 second',
        last_error='Verification deferred; retry or operator review required'
        where id=${job.id} and state='working' and attempts=${job.attempts}`;
      return false;
    }
  }
  async consumeOne() {
    return this.inbox.deliverOne(async (provider, token, product) => {
      if (provider !== "google") throw Error("Unsupported provider");
      const ref = await this.inbox.referenceForToken(token);
      if (!ref) throw Error("Receipt not bound");
      await this.verifier.consume(token, product, this.account(ref.member));
    });
  }
  async health() {
    await this.inbox.assertReady();
    const sql = this.inbox.sql,
      schema = this.inbox.reconciliationSchema;
    const [row] = await sql`select
      count(*) filter(where state='pending')::int pending,
      count(*) filter(where state='working')::int working,
      count(*) filter(where state='attention')::int attention,
      count(*) filter(where state<>'done' and created_at<clock_timestamp()-interval '1 hour')::int overdue
      from ${sql(schema)}.store_notifications`;
    return row;
  }
}

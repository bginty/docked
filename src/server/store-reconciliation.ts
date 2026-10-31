import type { StoreNotice } from "./google-store-notifications";
import type { StoreTestInbox } from "./store-test-inbox";
import type { GooglePlayTestVerifier } from "./store-purchase-verification";

/** Durable local acceptance worker. No public route/cron is activated by this module.
 * Unknown receipts stay pending until an authenticated purchase binds the member.
 * Tokens are loaded from the encrypted inbox, never retained in notification rows.
 */
export class StoreTestReconciliation {
  constructor(
    private inbox: StoreTestInbox,
    private verifier: Pick<GooglePlayTestVerifier, "verify" | "consume">,
    private account: (member: string) => string,
  ) {
    if (!inbox.localAcceptance)
      throw Error("Disposable local acceptance required");
  }
  async enqueue(n: StoreNotice) {
    const sql = this.inbox.sql;
    const rows =
      await sql`insert into credits_sandbox.store_notifications(id,receipt_key,kind,occurred_at,state,completed_at)
      values(${n.id},${n.receiptKey},${n.kind},${n.occurredAt},${n.kind === "test" ? "done" : "pending"},${n.kind === "test" ? new Date() : null})
      on conflict do nothing returning id`;
    return rows.length === 1;
  }
  async schedule(period: string) {
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(period))
      throw Error("Minute checkpoint required");
    const sql = this.inbox.sql;
    return sql`insert into credits_sandbox.store_notifications(id,receipt_key,kind,occurred_at)
      select ${period} || ':' || receipt_key,receipt_key,'scheduled',floor(extract(epoch from clock_timestamp())*1000)::bigint from credits_sandbox.store_receipts
      where provider='google' and status in ('PENDING','PURCHASED') on conflict do nothing returning id`;
  }
  async runOne() {
    const sql = this.inbox.sql;
    const [job] =
      await sql`update credits_sandbox.store_notifications set state='working',attempts=attempts+1,lease_until=clock_timestamp()+interval '60 seconds'
      where id=(select id from credits_sandbox.store_notifications where (state='pending' and next_attempt_at<=clock_timestamp()) or (state='working' and lease_until<clock_timestamp()) order by next_attempt_at,id for update skip locked limit 1) returning *`;
    if (!job) return false;
    try {
      const ref = await this.inbox.reference(job.receipt_key);
      if (!ref) throw Error("Receipt not bound");
      const account = this.account(ref.member);
      const receipt = await this.verifier.verify(ref.token, account);
      if (receipt.key !== job.receipt_key) throw Error("Receipt key mismatch");
      await this.inbox.accept(receipt, ref.member, account, ref.token);
      await sql`update credits_sandbox.store_notifications set state='done',completed_at=clock_timestamp(),lease_until=null,last_error=null where id=${job.id} and state='working' and attempts=${job.attempts}`;
      return true;
    } catch {
      await sql`update credits_sandbox.store_notifications set state='pending',lease_until=null,next_attempt_at=clock_timestamp()+interval '60 seconds',last_error='Verification deferred; retry required' where id=${job.id} and state='working' and attempts=${job.attempts}`;
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
}

import { randomUUID } from "node:crypto";
import type { Sql } from "postgres";
import type { StoreNotice } from "./google-store-notifications";
import type { GoogleCommercialVerifier } from "./google-commercial-verifier";
import { CommercialLedger } from "./commercial-ledger";

/** Same authenticated Google notification parser as TEST billing. Notifications
 * are hints only. Unknown references cannot create an account or grant credits. */
export class CommercialReconciliation {
  constructor(
    private ledger: CommercialLedger,
    private verifier: Pick<GoogleCommercialVerifier, "verify" | "consume">,
  ) {}
  async enqueue(n: StoreNotice) {
    if (
      !/^[a-f0-9]{64}$/.test(n.id) ||
      (n.receiptKey !== null && !/^[a-f0-9]{64}$/.test(n.receiptKey))
    )
      throw Error("Invalid notification reference");
    const rows = await this.ledger
      .sql`insert into commercial_billing.jobs(id,receipt,kind) values(${`push:${n.id}`},${n.receiptKey},${n.kind === "test" ? "test" : "verify"}) on conflict do nothing returning id`;
    return rows.length === 1;
  }
  async schedule() {
    // Database clock, bounded work, persisted cursor on each receipt. Revisit
    // consumed receipts too; consumption does not remove refund liability.
    return this.ledger.sql.begin(async (transaction) => {
      const tx = transaction as unknown as Sql;
      const rows =
        await tx`select key from commercial_billing.receipts where state in('PENDING','PURCHASED','REVIEW') and next_reconcile_at<=clock_timestamp() order by next_reconcile_at,key limit 50 for update skip locked`;
      for (const r of rows) {
        await tx`insert into commercial_billing.jobs(id,receipt,kind) values(${`periodic:${r.key}:${randomUUID()}`},${r.key},'verify')`;
        await tx`update commercial_billing.receipts set next_reconcile_at=clock_timestamp()+interval '6 hours' where key=${r.key}`;
      }
      return rows.length;
    });
  }
  async runOne() {
    const sql = this.ledger.sql,
      lease = randomUUID();
    await sql`update commercial_billing.jobs set state='attention',lease=null,lease_until=null,last_error='Expired final lease; operator review required' where state='working' and lease_until<clock_timestamp() and attempts>=12`;
    const rows =
      await sql`update commercial_billing.jobs set state='working',lease=${lease},lease_until=clock_timestamp()+interval '3 minutes',attempts=attempts+1 where id=(select id from commercial_billing.jobs where ((state='pending' and next_attempt_at<=clock_timestamp()) or (state='working' and lease_until<clock_timestamp())) and attempts<12 order by case when kind='consume' then 0 else 1 end,next_attempt_at,id limit 1 for update skip locked) returning *`;
    const job = rows[0];
    if (!job) return false;
    try {
      if (job.kind !== "test") {
        const ref = await this.ledger.reference(job.receipt);
        if (!ref) throw Error("Unknown receipt; await authenticated binding");
        // All events re-read Google. Never trust event order, amount or customer ID.
        const current = await this.verifier.verify(
          ref.token,
          ref.account_binding,
        );
        const accepted = await this.ledger.accept(
          current,
          ref.member_id,
          ref.token,
          async () => {},
          false,
        );
        if (job.kind === "consume" && accepted.state === "PURCHASED")
          await this.verifier.consume(ref.token, ref.account_binding);
      }
      await sql`update commercial_billing.jobs set state='done',completed_at=clock_timestamp(),lease=null,lease_until=null,last_error=null where id=${job.id} and lease=${lease}`;
    } catch {
      // No provider payload, token, legal identity or exception text in audit logs.
      await sql`update commercial_billing.jobs set state=${job.attempts >= 12 ? "attention" : "pending"},next_attempt_at=clock_timestamp()+${Math.min(3600, 15 * 2 ** Math.min(job.attempts, 8))}*interval '1 second',lease=null,lease_until=null,last_error='Provider reconciliation deferred; operator review if repeated' where id=${job.id} and lease=${lease}`;
    }
    return true;
  }
  async health() {
    const [row] = await this.ledger
      .sql`select count(*) filter(where state='attention')::int attention,count(*) filter(where state in('pending','working') and created_at<clock_timestamp()-interval '1 hour')::int overdue,count(*) filter(where state='done')::int completed from commercial_billing.jobs`;
    return {
      attention: Number(row.attention),
      overdue: Number(row.overdue),
      completed: Number(row.completed),
      attentionRequired: row.attention > 0 || row.overdue > 0,
    };
  }
}

import { randomUUID } from "node:crypto";
import type { Sql } from "postgres";
import type { StoreNotice } from "./google-store-notifications";
import type { GoogleCommercialVerifier } from "./google-commercial-verifier";
import { CommercialLedger } from "./commercial-ledger";
import {
  BillingOpsMonitor,
  billingFailureSignal,
  type BillingFailureStage,
} from "./billing-ops-monitor";
type ReconciliationJob = {
  id: string;
  receipt: string | null;
  kind: "verify" | "consume" | "test";
  attempts: number;
};

/** Same authenticated Google notification parser as TEST billing. Notifications
 * are hints only. Unknown references cannot create an account or grant credits. */
export class CommercialReconciliation {
  constructor(
    private ledger: CommercialLedger,
    private verifier: Pick<GoogleCommercialVerifier, "verify" | "consume">,
    private memberActive: (member: string) => Promise<boolean>,
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
    const rows = await sql<
      ReconciliationJob[]
    >`update commercial_billing.jobs set state='working',lease=${lease},lease_until=clock_timestamp()+interval '3 minutes',attempts=attempts+1 where id=(select id from commercial_billing.jobs where ((state='pending' and next_attempt_at<=clock_timestamp()) or (state='working' and lease_until<clock_timestamp())) and attempts<12 order by case when kind='consume' then 0 else 1 end,next_attempt_at,id limit 1 for update skip locked) returning *`;
    const job = rows[0];
    if (!job) return false;
    await this.process(job, lease);
    return true;
  }
  /** Fulfilment is already committed. Claim only this account-bound receipt's
   * durable consume job, so checkout never waits for an unrelated queue backlog.
   * A provider outage leaves the committed credits and retry job intact. */
  async acknowledgeReceipt(receipt: string, member: string) {
    if (
      !/^[a-f0-9]{64}$/.test(receipt) ||
      !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(
        member,
      )
    )
      throw Error("Invalid acknowledgement binding");
    const sql = this.ledger.sql,
      lease = randomUUID(),
      id = `consume:${receipt}`;
    const [existing] = await sql`select j.state,r.state receipt_state
      from commercial_billing.jobs j join commercial_billing.receipts r on r.key=j.receipt
      where j.id=${id} and j.kind='consume' and r.key=${receipt} and r.member_id=${member}`;
    if (!existing || existing.receipt_state !== "PURCHASED") return false;
    if (existing.state === "done") return true;
    const [job] = await sql<
      ReconciliationJob[]
    >`update commercial_billing.jobs set state='working',lease=${lease},lease_until=clock_timestamp()+interval '3 minutes',attempts=attempts+1
      where id=${id} and receipt=${receipt} and kind='consume' and attempts<12
      and ((state='pending' and next_attempt_at<=clock_timestamp()) or (state='working' and lease_until<clock_timestamp()))
      and exists(select 1 from commercial_billing.receipts r where r.key=${receipt} and r.member_id=${member} and r.state='PURCHASED') returning *`;
    if (!job) return false;
    return this.process(job, lease);
  }
  private async process(job: ReconciliationJob, lease: string) {
    const sql = this.ledger.sql;
    const monitor = new BillingOpsMonitor(sql);
    let stage: BillingFailureStage = "reconciliation";
    let acknowledged = false;
    try {
      if (job.kind !== "test") {
        if (!job.receipt) throw Error("Receipt binding unavailable");
        const ref = await this.ledger.reference(job.receipt);
        if (!ref) throw Error("Unknown receipt; await authenticated binding");
        // All events re-read Google. Never trust event order, amount or customer ID.
        const current = await this.verifier.verify(
          ref.token,
          ref.account_binding,
        );
        const eligible =
          current.state !== "PURCHASED" ||
          (await this.memberActive(ref.member_id));
        if (current.state === "REVOKED" || current.refundedCents > 0)
          stage = "refund";
        const accepted = await this.ledger.accept(
          eligible
            ? current
            : {
                ...current,
                state: "REVIEW",
                reviewReason: "account-unavailable",
              },
          ref.member_id,
          ref.token,
          async () => {},
          false,
        );
        if (job.kind === "consume" && accepted.state === "PURCHASED") {
          stage = "acknowledgement";
          await this.verifier.consume(ref.token, ref.account_binding);
          acknowledged = true;
        }
      }
      await sql`update commercial_billing.jobs set state='done',completed_at=clock_timestamp(),lease=null,lease_until=null,last_error=null where id=${job.id} and lease=${lease}`;
      return job.kind !== "consume" || acknowledged;
    } catch (error) {
      const signal = billingFailureSignal(stage, error);
      if (signal) await monitor.record(signal);
      // No provider payload, token, legal identity or exception text in audit logs.
      await sql`update commercial_billing.jobs set state=${job.attempts >= 12 ? "attention" : "pending"},next_attempt_at=clock_timestamp()+${Math.min(3600, 15 * 2 ** Math.min(job.attempts, 8))}*interval '1 second',lease=null,lease_until=null,last_error='Provider reconciliation deferred; operator review if repeated' where id=${job.id} and lease=${lease}`;
      return false;
    }
  }
  async run() {
    const monitor = new BillingOpsMonitor(this.ledger.sql);
    return monitor.run("reconciliation", async () => {
      const scheduled = await this.schedule();
      const results = await Promise.all([
        this.runOne(),
        this.runOne(),
        this.runOne(),
      ]);
      return {
        scheduled,
        attempted: results.filter(Boolean).length,
        ...(await this.health()),
      };
    });
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

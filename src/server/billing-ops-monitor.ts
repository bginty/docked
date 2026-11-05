import { createHash, randomUUID } from "node:crypto";
import type { Sql } from "postgres";

export type BillingFailureStage =
  | "verification"
  | "replay"
  | "fulfilment"
  | "pack"
  | "refund"
  | "acknowledgement"
  | "reconciliation";
export type BillingOpsSignal =
  | "receipt_verification_failed"
  | "purchase_fulfilment_failed"
  | "receipt_duplicate_retry"
  | "receipt_replay_rejected"
  | "refund_reconciliation_failed"
  | "pack_issuance_failed"
  | "pack_supply_unavailable"
  | "acknowledgement_failed"
  | "reconciliation_failed";

export function billingFailureSignal(
  stage: BillingFailureStage,
  error: unknown,
): BillingOpsSignal | null {
  const message = error instanceof Error ? error.message : "";
  if (message === "Receipt already bound to another account or product")
    return "receipt_replay_rejected";
  if (
    /^(Insufficient Docked Credits|Account review required before spending or purchasing|Explicit pack confirmation required|Pack quote changed; review again|Pack not found|Commercial feature disabled|Checkout disabled)$/.test(
      message,
    )
  )
    return null;
  if (
    stage === "pack" &&
    message === "Pack supply unavailable; no charge or substitution"
  )
    return "pack_supply_unavailable";
  return (
    {
      verification: "receipt_verification_failed",
      replay: "receipt_replay_rejected",
      fulfilment: "purchase_fulfilment_failed",
      pack: "pack_issuance_failed",
      refund: "refund_reconciliation_failed",
      acknowledgement: "acknowledgement_failed",
      reconciliation: "reconciliation_failed",
    } as const
  )[stage];
}

/** No Graph credential or mail flag is required in a member/worker runtime.
 * Default-off best-effort observer, called AFTER the financial transaction has
 * committed/rolled back. Monitoring failure cannot change its original result. */
export class BillingOpsMonitor {
  private readonly enabled: boolean;
  constructor(
    private sql: Sql,
    env: Record<string, string | undefined> = process.env,
    private warn: () => void = () =>
      console.warn(JSON.stringify({ event: "billing-ops-signal-unavailable" })),
  ) {
    this.enabled = env.DOCKED_BILLING_OPS_SIGNALS === "true";
  }
  async record(code: BillingOpsSignal, operation?: string) {
    if (!this.enabled) return;
    try {
      const id = operation ?? randomUUID();
      await this
        .sql`select public.docked_billing_ops_signal(${code},${id}::uuid)`;
    } catch {
      this.unavailable();
    }
  }
  async run<T>(stage: BillingFailureStage, work: () => Promise<T>): Promise<T> {
    try {
      return await work();
    } catch (error) {
      const code = billingFailureSignal(stage, error);
      if (code) await this.record(code);
      throw error;
    }
  }
  async isKnownReceiptReplay(token: string, member: string, account: string) {
    if (!this.enabled) return false;
    try {
      const key = createHash("sha256")
        .update("docked.fantasy\0" + token)
        .digest("hex");
      const [r] = await this
        .sql`select exists(select 1 from commercial_billing.receipts where key=${key} and (member_id<>${member} or account_binding<>${account})) replay`;
      return r.replay === true;
    } catch {
      this.unavailable();
      return false;
    }
  }
  private unavailable() {
    try {
      this.warn();
    } catch {
      /* preserve original operation */
    }
  }
}

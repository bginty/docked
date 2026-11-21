import type { Sql } from "postgres";
import { z } from "zod";

const uuid = z.uuid();
const date = z.string().datetime({ offset: true });
const amount = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const cleanupState = z.enum(["not_required", "queued", "confirmed"]);
const closure = z
  .object({
    requestedAt: date,
    providerCleanup: cleanupState,
    localCleanup: cleanupState,
    financialReview: cleanupState,
    completedAt: date.nullable(),
  })
  .strict();

export const withdrawalAccountExportSchema = z
  .object({
    identity: z
      .object({
        provider: z.literal("sumsub"),
        status: z.enum(["pending", "approved", "rejected"]),
        country: z.string().max(3).nullable(),
        adult: z.boolean(),
        revision: z.number().int().positive(),
        createdAt: date,
        checkedAt: date.nullable(),
      })
      .strict()
      .nullable(),
    withdrawals: z.array(
      z
        .object({
          id: uuid,
          status: z.enum([
            "REQUESTED",
            "UNDER_REVIEW",
            "APPROVED",
            "PAYMENT_IN_PROGRESS",
            "EXCEPTION",
            "SENT",
            "RECONCILED",
            "REJECTED",
            "CANCELLED",
            "RELEASED",
            "RETURNED",
          ]),
          revision: z.number().int().positive(),
          credits: amount,
          grossAudCents: amount,
          feeCents: amount,
          audCents: amount,
          currency: z.literal("AUD"),
          policyVersion: z.string().min(1).max(240),
          destination: uuid,
          bankMask: z.string().regex(/^\*{4}\d{4}$/),
          createdAt: date,
          updatedAt: date,
          sentAt: date.nullable(),
          reconciledAt: date.nullable(),
          returnedAt: date.nullable(),
        })
        .strict(),
    ),
    destinations: z.array(
      z
        .object({
          id: uuid,
          bankMask: z.string().regex(/^\*{4}\d{4}$/),
          createdAt: date,
        })
        .strict(),
    ),
    accountClosure: closure.nullable(),
  })
  .strict();

export const withdrawalAccountDeletionSchema = closure
  .extend({ pending: z.boolean() })
  .strict();
export type WithdrawalAccountExport = z.infer<
  typeof withdrawalAccountExportSchema
>;
export type WithdrawalAccountDeletion = z.infer<
  typeof withdrawalAccountDeletionSchema
>;
export class WithdrawalAccountCleanupPending extends Error {
  constructor() {
    super("Withdrawal account cleanup review remains pending");
    this.name = "WithdrawalAccountCleanupPending";
  }
}

/** Availability never depends on the cash activation switch: switching cash OFF
 * cannot hide earlier records or turn a queued erasure into completed deletion. */
async function accountModule(sql: Sql, operation: "export" | "deletion") {
  const [row] = await sql`
    select exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='commercial_billing' and c.relname='withdrawal_control') installed,
      to_regprocedure('private.withdrawal_account_export(uuid,uuid,text)') is not null exporter,
      to_regprocedure('private.withdrawal_account_deletion_status(uuid)') is not null deletion`;
  if (!row?.installed) return false;
  if (row[operation === "export" ? "exporter" : "deletion"] !== true)
    throw Error("Withdrawal account lifecycle migration is incomplete");
  return true;
}

export async function exportWithdrawalAccount(
  sql: Sql,
  identity: { member: string; sessionId: string; aal: string },
  env: Record<string, string | undefined> = process.env,
): Promise<WithdrawalAccountExport | null> {
  if (env.DOCKED_BETA_STAGING === "true") return null;
  uuid.parse(identity.member);
  uuid.parse(identity.sessionId);
  z.enum(["aal1", "aal2"]).parse(identity.aal);
  if (!(await accountModule(sql, "export"))) return null;
  return sql.begin(async (transaction) => {
    const tx = transaction as unknown as Sql;
    await tx`select set_config('request.jwt.claim.sub',${identity.member},true),
      set_config('request.jwt.claims',${JSON.stringify({ sub: identity.member, session_id: identity.sessionId, aal: identity.aal })},true)`;
    const [row] =
      await tx`select private.withdrawal_account_export(${identity.member}::uuid,${identity.sessionId}::uuid,${identity.aal}) data`;
    return row?.data == null
      ? null
      : withdrawalAccountExportSchema.parse(row.data);
  });
}

/** Called after access revocation. The database requires a matching durable
 * deletion job; this records cleanup intent only and never contacts a provider. */
export async function withdrawalAccountDeletionStatus(
  sql: Sql,
  member: string,
  env: Record<string, string | undefined> = process.env,
): Promise<WithdrawalAccountDeletion | null> {
  if (env.DOCKED_BETA_STAGING === "true") return null;
  uuid.parse(member);
  if (!(await accountModule(sql, "deletion"))) return null;
  const [row] =
    await sql`select private.withdrawal_account_deletion_status(${member}::uuid) data`;
  return row?.data == null
    ? null
    : withdrawalAccountDeletionSchema.parse(row.data);
}

/** Auth erasure must already have been verified by the caller. Only the active
 * profile is removed here; financial facts, balances and pending cleanup remain. */
export async function finishAccountDeletion(
  sql: Sql,
  member: string,
  env: Record<string, string | undefined> = process.env,
) {
  uuid.parse(member);
  return sql.begin(async (transaction) => {
    const tx = transaction as unknown as Sql;
    // The status helper locks the financial account first. Keep that lock until
    // job completion, so a late provider check cannot be overwritten as "done".
    const pending =
      (await withdrawalAccountDeletionStatus(tx, member, env))?.pending ===
      true;
    const [job] = await tx`select state,payload from private.job_runs
      where kind='account_deletion' and dedupe_key=${`account-deletion:${member}`} for update`;
    if (!job) throw Error("Recorded account-deletion request required");
    if (job.state === "done") return { pending: false };
    if (job.payload?.userId !== member)
      throw Error("Account-deletion identity does not match its request");
    const [active] =
      await tx`select id from public.profiles where id=${member} and disabled_at is null`;
    if (active) throw Error("Account must be disabled before erasure");
    await tx`delete from public.profiles where id=${member}`;
    if (pending) {
      await tx`update private.job_runs set state='pending_review',lease_until=null,lease_token=null,
        failure_reason='Withdrawal account cleanup remains pending',owner_action='Review withdrawal, recovery and provider cleanup evidence'
        where kind='account_deletion' and dedupe_key=${`account-deletion:${member}`}`;
      return { pending: true };
    }
    await tx`update private.job_runs set payload='{}',state='done',last_success=clock_timestamp(),lease_until=null,lease_token=null,failure_reason=null,owner_action=null
      where kind='account_deletion' and dedupe_key=${`account-deletion:${member}`}`;
    await tx`insert into private.audit_events(actor,action,subject) values('account-service','account_erasure_completed',${member})`;
    return { pending: false };
  });
}

export function accountDeletionPendingMessage(
  reason: "identity" | "withdrawal",
) {
  return reason === "withdrawal"
    ? "Account access is revoked. Required withdrawal, recovery or identity-provider cleanup review remains pending. Financial records and balances are preserved; contact support for your request status."
    : "Account access revoked. Identity erasure is queued for retry.";
}

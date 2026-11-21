import { createClient } from "@supabase/supabase-js";
import { db } from "./db";
import { eraseAuthRetainingReferences } from "./auth-erasure";
import {
  finishAccountDeletion,
  WithdrawalAccountCleanupPending,
} from "./commercial-withdrawal-account";
/** Called only after private.disable_account has atomically revoked access and queued erasure. */
export async function processAccountDeletion(userId: string) {
  if (process.env.DOCKED_BETA_STAGING === "true")
    throw new Error("Beta erasure must not delete shared Auth identities");
  const sql = db();
  const rows =
    await sql`select disabled_at from public.profiles where id=${userId}`;
  if (rows[0] && !rows[0].disabled_at)
    throw new Error("Account must be disabled before erasure");
  const [job] =
    await sql`select state,payload from private.job_runs where kind='account_deletion' and dedupe_key=${`account-deletion:${userId}`}`;
  if (!job) throw new Error("Recorded account-deletion request required");
  if (job.state === "done") return;
  if (job.payload?.userId !== userId)
    throw new Error("Account-deletion identity does not match its request");
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY)
    throw new Error("Auth erasure credentials pending; access remains revoked");
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SECRET_KEY,
    {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        fetch: (input, init) =>
          fetch(input, {
            ...init,
            signal: init?.signal
              ? AbortSignal.any([init.signal, AbortSignal.timeout(15_000)])
              : AbortSignal.timeout(15_000),
          }),
      },
    },
  );
  await eraseAuthRetainingReferences(admin.auth.admin, userId);
  let result: { pending: boolean };
  try {
    result = await finishAccountDeletion(sql, userId);
  } catch {
    throw new WithdrawalAccountCleanupPending();
  }
  if (result.pending) throw new WithdrawalAccountCleanupPending();
}

import { createClient } from "@supabase/supabase-js";
import { db } from "./db";
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
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error && error.code !== "user_not_found")
    throw new Error("Remote Auth erasure pending; retry safely");
  await sql.begin(async (tx) => {
    // Serialise completion after Auth erasure. Concurrent retries may see an
    // already-deleted Auth user; only one completion/audit event is recorded.
    const [current] =
      await tx`select state from private.job_runs where kind='account_deletion' and dedupe_key=${`account-deletion:${userId}`} for update`;
    if (!current) throw new Error("Account-deletion request unavailable");
    if (current?.state === "done") return;
    await tx`delete from public.profiles where id=${userId}`;
    await tx`update private.job_runs set payload='{}',state='done',last_success=clock_timestamp(),lease_until=null,lease_token=null,failure_reason=null,owner_action=null where kind='account_deletion' and dedupe_key=${`account-deletion:${userId}`}`;
    await tx`insert into private.audit_events(actor,action,subject) values('account-service','account_erasure_completed',${userId})`;
  });
}

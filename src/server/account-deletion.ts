import { createClient } from "@supabase/supabase-js";
import { db } from "./db";
/** Called only after private.disable_account has atomically revoked access and queued erasure. */
export async function processAccountDeletion(userId: string) {
  if (process.env.DOCKED_BETA_STAGING === 'true')
    throw new Error('Beta erasure must not delete shared Auth identities');
  const sql = db();
  const rows =
    await sql`select disabled_at from public.profiles where id=${userId}`;
  if (rows[0] && !rows[0].disabled_at)
    throw new Error("Account must be disabled before erasure");
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY)
    throw new Error("Auth erasure credentials pending; access remains revoked");
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SECRET_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error && error.code !== "user_not_found")
    throw new Error("Remote Auth erasure pending; retry safely");
  await sql.begin(async (tx) => {
    await tx`delete from public.profiles where id=${userId}`;
    await tx`update private.job_runs set payload='{}' where kind='account_deletion' and payload->>'userId'=${userId}`;
    await tx`insert into private.audit_events(actor,action,subject) values('account-service','account_erasure_completed',${userId})`;
  });
}

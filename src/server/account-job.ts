import { db } from "./db";
/** Completion is bound to the leased account-erasure job, never a generic worker job. */
export async function finishJob(
  id: string,
  token: string,
  duration: number,
  error?: string,
) {
  const sql = db();
  if (error)
    await sql`update private.job_runs set state=case when attempts>=5 then 'dead' else 'queued' end,available_at=now()+power(2,attempts)*interval '10 seconds',failure_reason=${error},owner_action='Inspect account erasure and retry after remediation',lease_until=null,duration_ms=${duration} where id=${id} and lease_token=${token} and state='leased' and kind='account_deletion'`;
  else
    await sql`update private.job_runs set state='done',last_success=now(),duration_ms=${duration},lease_until=null where id=${id} and lease_token=${token} and state='leased' and kind='account_deletion'`;
}

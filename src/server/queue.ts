import { db } from "./db";
import { randomUUID } from "node:crypto";
import { leaseOutboxRecord } from "./outbox-lease";
export async function leaseJob() {
  const sql = db(),
    token = randomUUID();
  const rows =
    await sql`update private.job_runs set state='leased',lease_token=${token},lease_until=now()+interval '60 seconds',attempts=attempts+1 where id=(select id from private.job_runs where (state='queued' or (state='leased' and lease_until<now())) and available_at<=now() and attempts<5 order by created_at for update skip locked limit 1) returning *`;
  return rows[0] ?? null;
}
export async function finishJob(
  id: string,
  token: string,
  duration: number,
  error?: string,
) {
  const sql = db();
  if (error)
    await sql`update private.job_runs set state=case when attempts>=5 then 'dead' else 'queued' end,available_at=now()+power(2,attempts)*interval '10 seconds',failure_reason=${error},owner_action='Inspect provider health and retry after remediation',lease_until=null,duration_ms=${duration} where id=${id} and lease_token=${token} and state='leased'`;
  else
    await sql`update private.job_runs set state='done',last_success=now(),duration_ms=${duration},lease_until=null where id=${id} and lease_token=${token} and state='leased'`;
}
export async function leaseOutbox() {
  return leaseOutboxRecord(db());
}

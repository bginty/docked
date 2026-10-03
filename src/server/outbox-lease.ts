import { randomUUID } from "node:crypto";
import type { Sql, TransactionSql } from "postgres";

/** Normal queue leasing, optionally limited to a known notification by an operator workflow. */
export async function leaseOutboxRecord(
  sql: Sql | TransactionSql,
  onlyId?: string,
) {
  const token = randomUUID();
  const rows =
    await sql`update private.outbox set state='leased',lease_token=${token},lease_until=now()+interval '60 seconds',attempts=attempts+1 where id=(select id from private.outbox where (${onlyId ?? null}::uuid is null or id=${onlyId ?? null}::uuid) and (state='queued' or (state='leased' and lease_until<now())) and available_at<=now() and attempts<5 order by created_at for update skip locked limit 1) returning *`;
  return rows[0] ?? null;
}

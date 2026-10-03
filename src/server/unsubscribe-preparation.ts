import type { TransactionSql } from "postgres";
import { unsubscribeToken } from "@/core/delivery";
import { hash } from "@/core/pricing";

/** Shared notification preparation only. No provider, delivery attempt or network send. */
export async function prepareOutboxUnsubscribe(
  tx: TransactionSql,
  input: {
    outboxId: string;
    userId: string;
    leaseToken: string;
    secret: string;
  },
) {
  const recipients =
    await tx`select p.id,p.timezone from public.profiles p join private.outbox o on o.user_id=p.id
    where o.id=${input.outboxId} and o.user_id=${input.userId} and o.state='leased' and o.lease_token=${input.leaseToken}
    and o.lease_until>clock_timestamp() and o.expires_at>clock_timestamp() and p.disabled_at is null for share of p`;
  if (!recipients.length) return null;
  const token = unsubscribeToken(input.outboxId, input.userId, input.secret);
  await tx`insert into private.unsubscribe_tokens(token_hash,user_id) values(${hash(token)},${input.userId}) on conflict do nothing`;
  return { token, timezone: recipients[0].timezone as string };
}

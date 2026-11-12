/** Exact status-only disposition. Caller owns target/approval/backup/fresh-proof
 * validation and the transaction. This module opens no connection. */
import assert from "node:assert/strict";
import { z } from "zod";
import { digest } from "../../src/core/scoring-engine";

const rowSchema = z
  .object({
    id: z.string().min(1),
    receipt_key: z.string().regex(/^[a-f0-9]{64}$/),
    kind: z.enum(["purchase", "voided"]),
    occurred_at: z.number().int(),
    state: z.literal("attention"),
    attempts: z.literal(12),
    lease_until: z.string().nullable(),
    next_attempt_at: z.string(),
    last_error: z.string().nullable(),
    created_at: z.string(),
    completed_at: z.null(),
  })
  .strict();
export type HistoricalWarning = z.infer<typeof rowSchema>;
export function validateHistoricalWarnings(input: unknown) {
  const rows = z.array(rowSchema).length(7).parse(input);
  assert.equal(
    new Set(rows.map((r) => r.id)).size,
    7,
    "Seven unique warnings required",
  );
  assert.deepEqual(
    [...Map.groupBy(rows, (r) => r.receipt_key).values()]
      .map((r) => r.length)
      .sort(),
    [2, 2, 3],
  );
  return rows;
}

const literal = (value: unknown) =>
  "'" + JSON.stringify(value).replaceAll("'", "''") + "'::jsonb";
export function historicalWarningSql(input: {
  rows: unknown;
  approvalReference: string;
  packageSha256: string;
  evidenceSha256: string;
  manifestSha256: string;
}) {
  const rows = validateHistoricalWarnings(input.rows);
  assert.match(input.packageSha256, /^[a-f0-9]{64}$/);
  assert.match(input.evidenceSha256, /^[a-f0-9]{64}$/);
  assert.match(input.manifestSha256, /^[a-f0-9]{64}$/);
  assert(
    input.approvalReference.trim().length >= 12 &&
      input.approvalReference.length <= 2000,
  );
  const metadata = {
    version: "v31-historical-test-warning-disposition-v1",
    meaning:
      "externally reconciled original Preview TEST; not a Production fulfilment",
    approvalReference: input.approvalReference,
    packageSha256: input.packageSha256,
    evidenceSha256: input.evidenceSha256,
    manifestSha256: input.manifestSha256,
    originalRowsDigest: digest(rows),
    originalPreviewRecoveryHoldCredits: 5700,
    recoveryHoldWaived: false,
    walletMutation: false,
    inventoryMutation: false,
    providerMutation: false,
  };
  return `
set local lock_timeout='3s';
set local statement_timeout='30s';
lock table credits_sandbox.store_notifications in share row exclusive mode;
create temporary table historical_warning_expected on commit drop as
 select * from jsonb_populate_recordset(null::credits_sandbox.store_notifications,${literal(rows)});
do $guard$ begin
 if not exists(select 1 from commercial_billing.control where id and environment='commercial'
  and not sales_enabled and not issuance_enabled and not transfers_enabled and not gameplay_enabled)
 then raise exception 'Closed commercial controls required';end if;
 if exists(select 1 from commercial_billing.products where approved)
 then raise exception 'Unapproved products required';end if;
 if not exists(select 1 from pg_trigger where tgrelid='private.audit_events'::regclass
  and tgname='immutable' and tgenabled='O') then raise exception 'Immutable audit trigger required';end if;
 if (select count(*) from historical_warning_expected)<>7 or exists(
  select 1 from historical_warning_expected e left join credits_sandbox.store_notifications n using(id)
  where n.id is null or to_jsonb(e) is distinct from to_jsonb(n)
    or n.state<>'attention' or n.attempts<>12 or n.completed_at is not null
    or (n.lease_until is not null and n.lease_until>=clock_timestamp()))
 then raise exception 'Exact historical warning baseline or lease changed';end if;
end $guard$;
create temporary table historical_warning_other on commit drop as
 select to_jsonb(n) row from credits_sandbox.store_notifications n where not exists(select 1 from historical_warning_expected e where e.id=n.id);
update credits_sandbox.store_notifications n set state='done',completed_at=clock_timestamp(),lease_until=null
 from historical_warning_expected e where n.id=e.id;
do $guard$ begin
 if (select count(*) from credits_sandbox.store_notifications n join historical_warning_expected e using(id)
  where n.state='done' and n.completed_at is not null and n.lease_until is null
  and (to_jsonb(n)-'state'-'completed_at'-'lease_until')=(to_jsonb(e)-'state'-'completed_at'-'lease_until'))<>7
 then raise exception 'Historical warning preservation check failed';end if;
 if exists((select row from historical_warning_other except select to_jsonb(n) from credits_sandbox.store_notifications n where not exists(select 1 from historical_warning_expected e where e.id=n.id))
  union all (select to_jsonb(n) from credits_sandbox.store_notifications n where not exists(select 1 from historical_warning_expected e where e.id=n.id) except select row from historical_warning_other))
 then raise exception 'Unrelated notification changed';end if;
end $guard$;
insert into private.audit_events(actor,action,subject,details)
select 'operator:codex','historical-google-test-externally-reconciled','v31-seven-preview-test-notifications',
 ${literal(metadata)} || jsonb_build_object(
  'before',(select jsonb_agg(to_jsonb(e) order by id) from historical_warning_expected e),
  'after',(select jsonb_agg(to_jsonb(n) order by n.id) from credits_sandbox.store_notifications n join historical_warning_expected e using(id)));
set constraints all immediate;
`;
}

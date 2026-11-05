import assert from "node:assert/strict";
import type { Sql } from "postgres";
import {
  validateDormantCommercialPool,
  type DormantPoolDefinition,
} from "../src/core/commercial-pool-plan";

/** Operator-reviewed dormant configuration only. Never issues cards, approves a
 * definition/product, changes gates, or modifies an existing snapshot. */
export async function importDormantCommercialPool(
  sql: Sql,
  rows: DormantPoolDefinition[],
) {
  validateDormantCommercialPool(rows);
  return sql.begin(async (tx) => {
    await tx`set local lock_timeout='5s'`;
    const [control] =
      await tx`select * from commercial_billing.control where id for update`;
    assert(
      control &&
        !control.sales_enabled &&
        !control.issuance_enabled &&
        !control.transfers_enabled,
      "All commercial transaction gates must remain closed",
    );
    const products = await tx`select approved from commercial_billing.products`;
    assert(
      products.every((p) => p.approved === false),
      "Products must remain unapproved",
    );
    const source = tx.json(rows as never);
    const conflicts =
      await tx`select d.id from commercial_billing.definitions d join jsonb_to_recordset(${source}) r(id uuid,player_id uuid,sport text,rarity text,lifetime_cap int,issued int,legacy_issued int,approved bool,rights_reference text,snapshot jsonb) on (d.sport,d.player_id,d.rarity)=(r.sport,r.player_id,r.rarity) where to_jsonb(d) is distinct from to_jsonb(r)`;
    assert.equal(
      conflicts.length,
      0,
      "Existing immutable definition differs; explicit review required",
    );
    const inserted =
      await tx`insert into commercial_billing.definitions(id,player_id,sport,rarity,lifetime_cap,issued,legacy_issued,approved,rights_reference,snapshot) select id,player_id,sport,rarity,lifetime_cap,issued,legacy_issued,approved,rights_reference,snapshot from jsonb_to_recordset(${source}) r(id uuid,player_id uuid,sport text,rarity text,lifetime_cap int,issued int,legacy_issued int,approved bool,rights_reference text,snapshot jsonb) on conflict(sport,player_id,rarity) do nothing returning id`;
    return {
      inserted: inserted.length,
      unchanged: rows.length - inserted.length,
      approved: 0,
      issued: 0,
      activation: false,
    };
  });
}

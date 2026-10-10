import type { Sql } from "postgres";
import type { PrizeRegister } from "../core/prize-register";
export async function updatePrizeRegister(
  sql: Sql,
  change: (old: PrizeRegister) => PrizeRegister,
) {
  return sql.begin(async (tx) => {
    const [row] =
      await tx`select document from commerce_sandbox.prizes where id for update`;
    if (!row) throw Error("Synthetic register not configured");
    const next = change(row.document as PrizeRegister);
    if (next.scope !== "synthetic-only") throw Error("Synthetic awards only");
    if (JSON.stringify(next) !== JSON.stringify(row.document)) {
      await tx`insert into commerce_sandbox.prize_history(document) values(${tx.json(next as any)})`;
      await tx`update commerce_sandbox.prizes set document=${tx.json(next as any)} where id`;
    }
    return next;
  });
}

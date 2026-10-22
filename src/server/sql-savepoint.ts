import type { Sql, TransactionSql } from "postgres";
/** Repositories that open a transaction can safely participate in a caller's
 * transaction: their begin becomes a savepoint, retaining atomic outer commit. */
export function savepointConnection(tx: TransactionSql): Sql {
  return new Proxy(tx, {
    get(target, key) {
      if (key === "begin") return target.savepoint.bind(target);
      return Reflect.get(target, key);
    },
  }) as unknown as Sql;
}

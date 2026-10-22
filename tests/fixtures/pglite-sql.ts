import type { PGlite, Transaction } from "@electric-sql/pglite";
import type { Sql } from "postgres";
/** Test transport only: production repository SQL executes unchanged in PGlite.
 * Concurrency/isolation acceptance additionally runs against native PostgreSQL. */
export function pgliteSql(pg: PGlite | Transaction, nested = false): Sql {
  const tag = async (strings: TemplateStringsArray, ...args: unknown[]) => {
    const query = strings.reduce(
      (s, part, i) => s + (i ? `$${i}` : "") + part,
      "",
    );
    return (await pg.query(query, args)).rows;
  };
  const transaction = async (fn: (tx: Sql) => Promise<unknown>) => {
    if (!nested && "transaction" in pg)
      return pg.transaction((tx) => fn(pgliteSql(tx, true)));
    await pg.exec("savepoint repository_call");
    try {
      const r = await fn(pgliteSql(pg, true));
      await pg.exec("release savepoint repository_call");
      return r;
    } catch (e) {
      await pg.exec("rollback to savepoint repository_call");
      throw e;
    }
  };
  return Object.assign(tag, {
    json: (x: unknown) => JSON.stringify(x),
    begin: transaction,
    savepoint: transaction,
    unsafe: async (query: string, args: unknown[] = []) =>
      (await pg.query(query, args)).rows,
  }) as unknown as Sql;
}

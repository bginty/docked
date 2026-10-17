import type { FeedDb } from "./nfl-testing-store";

/** Reuse the revision/checkpoint importer in a distinct history-only schema.
 * The restricted database roles are the security boundary, not this adapter.
 * No competition bridge is installed or invoked for this store. */
export function historyStore(db: FeedDb): FeedDb {
  return {
    query: (sql, values) =>
      db.query(sql.replaceAll("nfl_test_feed.", "nfl_history."), values),
    transaction: (fn) => db.transaction((tx) => fn(historyStore(tx))),
  };
}

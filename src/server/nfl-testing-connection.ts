import postgres from "postgres";
import type { FeedDb } from "./nfl-testing-store";
export function connectTestingFeedDatabase(
  raw: string,
  vercelEnvironment?: string,
) {
  const url = new URL(raw);
  if (
    vercelEnvironment === "production" ||
    !["postgres:", "postgresql:"].includes(url.protocol) ||
    !["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) ||
    !/^\/docked_nfl_test_[a-z0-9_]+$/.test(url.pathname)
  )
    throw Error(
      "Disposable loopback NFL testing database required; hosted activation is disabled",
    );
  const sql = postgres(raw, { max: 2 });
  const adapt = (connection: any): FeedDb => ({
    query: async (query, values = []) => ({
      rows: await connection.unsafe(query, values),
    }),
    transaction: async (fn) => connection.begin((tx: any) => fn(adapt(tx))),
  });
  return { db: adapt(sql), sql, close: () => sql.end() };
}

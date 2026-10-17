import postgres from "postgres";
import { feedPostgresTypes } from "./nfl-feed-postgres-types";
import { databaseConnectionOptions } from "./database-tls";
import {
  historyDatabaseTarget,
  nflHistoryTarget as target,
} from "../core/nfl-history-target";
import type { FeedDb } from "./nfl-testing-store";
export function openNflHistory(role: "reader" | "writer") {
  const raw =
    process.env[
      role === "reader"
        ? "NFL_HISTORY_READER_DATABASE_URL"
        : "NFL_HISTORY_WRITER_DATABASE_URL"
    ] ?? "";
  const expected = historyDatabaseTarget(raw, role);
  const sql = postgres(raw, {
    types: feedPostgresTypes,
    max: 2,
    prepare: false,
    connect_timeout: 15,
    ...databaseConnectionOptions(raw),
    onnotice: () => {},
  });
  let checked: Promise<void> | undefined;
  const verify = () =>
    (checked ??= (async () => {
      const [r] =
        await sql`select b.*,current_user role,r.rolsuper,r.rolbypassrls,r.rolcreaterole,r.rolcreatedb
      from nfl_history.host_binding b join pg_roles r on r.rolname=current_user where b.id=1`;
      if (
        !r ||
        r.project_ref !== target.projectRef ||
        r.purpose !== target.marker ||
        r.role !== expected ||
        r.rolsuper ||
        r.rolbypassrls ||
        r.rolcreaterole ||
        r.rolcreatedb
      )
        throw Error("Player-history binding mismatch");
    })());
  const adapt = (connection: any): FeedDb => ({
    query: async (query, values = []) => {
      await verify();
      return { rows: await connection.unsafe(query, values) };
    },
    transaction: async (fn) => {
      await verify();
      return connection.begin((tx: any) => fn(adapt(tx)));
    },
  });
  return { db: adapt(sql), verify, close: () => sql.end() };
}

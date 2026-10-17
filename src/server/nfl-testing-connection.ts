import postgres from "postgres";
import type { FeedDb } from "./nfl-testing-store";
import { databaseConnectionOptions } from "./database-tls";
import {
  nflHostedTarget,
  testingDatabaseTarget,
} from "../core/nfl-hosted-target.mjs";
export function connectTestingFeedDatabase(
  raw: string,
  vercelEnvironment?: string,
) {
  const target = testingDatabaseTarget(raw, vercelEnvironment);
  const sql = postgres(raw, {
    max: 2,
    prepare: false,
    connect_timeout: 15,
    ...databaseConnectionOptions(raw),
    onnotice: () => {},
  });
  let verified: Promise<void> | undefined;
  const verify = () =>
    (verified ??= (async () => {
      if (!target.hosted) return;
      const rows = await sql`select m.project_ref,m.purpose,current_user role,
      r.rolsuper,r.rolbypassrls,r.rolcreatedb,r.rolcreaterole
      from nfl_test_feed.host_binding m join pg_roles r on r.rolname=current_user where m.id=1`;
      const r = rows[0];
      if (
        !r ||
        r.project_ref !== nflHostedTarget.projectRef ||
        r.purpose !== nflHostedTarget.databaseMarker ||
        r.role !== target.role ||
        r.rolsuper ||
        r.rolbypassrls ||
        r.rolcreatedb ||
        r.rolcreaterole
      )
        throw Error("NFL database identity or privileges mismatch");
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
  return { db: adapt(sql), sql, verify, close: () => sql.end() };
}

/** Observe only this run's pg_dump activity, never print SQL or session identities. */
import { ownerDatabase } from "./owner-gameplay-db.mjs";
const root = process.cwd();
process.chdir("C:/Users/61412/Documents/ChatGPT/Docked.com.au");
const sql = ownerDatabase();
process.chdir(root);
async function main() {
  try {
    const rows = await sql.begin(
      "read only",
      (tx) =>
        tx`select application_name,state,wait_event_type,wait_event,extract(epoch from now()-query_start)::int query_age_seconds,extract(epoch from now()-xact_start)::int transaction_age_seconds, cardinality(pg_blocking_pids(pid)) blocking_sessions, case when query ilike '%pg_catalog%' then 'catalogue' when query ilike 'COPY %' then 'copy' else 'other' end query_category from pg_stat_activity where application_name='pg_dump' or (backend_type='client backend' and xact_start<now()-interval '2 minutes') order by backend_start`,
    );
    console.log(
      JSON.stringify({
        at: new Date().toISOString(),
        rows,
        productionWrites: 0,
      }),
    );
  } finally {
    await sql.end({ timeout: 3 });
  }
}
main().catch(() => {
  console.error("Read-only backup progress unavailable");
  process.exitCode = 1;
});

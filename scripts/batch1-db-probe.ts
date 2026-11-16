import { readFileSync } from "node:fs";
import { batch1Database } from "./lib/batch1-isolated-db";
async function main() {
  const sql = batch1Database("postgres");
  const rollback = new Error("isolated rollback");
  try {
    console.log(await sql`select current_database(),current_user`);
    if (process.argv.includes("--session-guard")) {
      console.log(
        await sql`select pg_get_functiondef('beta_private.active_member_session()'::regprocedure) body`,
      );
      console.log(
        await sql`select count(*) sessions, count(*)filter(where not_after is null or not_after>now()) unexpired from auth.sessions where user_id='d6ab4838-7108-4c50-8ab8-c5947ab55bd8'::uuid`,
      );
      return;
    }
    if (process.argv.includes("--transfer-guard")) {
      console.log(
        await sql`select pg_get_functiondef(tgfoid) body,encode(sha256(convert_to(replace(pg_get_functiondef(tgfoid),E'\r',''),'UTF8')),'hex') hash from pg_trigger where tgrelid='credits_sandbox.state'::regclass and tgname='rarity_lineup_transfer'`,
      );
      return;
    }
    if (process.argv.includes("--inventory-triggers")) {
      const rows =
        await sql`select t.tgname,encode(sha256(convert_to(replace(pg_get_functiondef(t.tgfoid),E'\r',''),'UTF8')),'hex') hash from pg_trigger t where t.tgrelid='sports_feed.sport_sandbox_inventory'::regclass and not t.tgisinternal`;
      console.log(JSON.stringify(rows));
      return;
    }
    await sql
      .begin(async (tx) => {
        await tx.unsafe(
          readFileSync(
            "supabase/migrations/20261115113306_batch_private_pack_issuance_validation.sql",
            "utf8",
          ),
        );
        console.log(
          await tx`select encode(sha256(convert_to(replace(pg_get_functiondef('credits_sandbox.guard_economy_state()'::regprocedure),E'\r',''),'UTF8')),'hex') guard_hash, encode(sha256(convert_to(replace(pg_get_functiondef('credits_sandbox.project_fixture_inventory()'::regprocedure),E'\r',''),'UTF8')),'hex') project_hash`,
        );
        if (process.argv.includes("--additional")) {
          await tx.unsafe(
            readFileSync(
              "supabase/migrations/20261115211545_batch1_pack_guard_batching.sql",
              "utf8",
            ),
          );
          console.log({ additionalApplied: true });
        }
        throw rollback;
      })
      .catch((e) => {
        if (e !== rollback) throw e;
      });
  } finally {
    await sql.end({ timeout: 5 });
  }
}
void main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});

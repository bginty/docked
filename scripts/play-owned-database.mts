import fs from "node:fs/promises";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { ownerDatabase, projectRef } from "./owner-gameplay-db.mjs";
const root = process.cwd(),
  out = root + "/docs/qa/play-owned/release";
const file = "20261023052447_play_owned_inventory.sql";
const body = await fs.readFile(root + "/supabase/migrations/" + file, "utf8");
const hash = createHash("sha256").update(body).digest("hex"),
  mode = process.argv[2];
assert(["rehearse", "apply", "verify"].includes(mode));
assert.equal(projectRef, "pojoymtniryarxxunyvz");
await fs.mkdir(out, { recursive: true });
process.chdir("C:/Users/61412/Documents/ChatGPT/Docked.com.au");
const sql = ownerDatabase();
try {
  if (mode === "apply") {
    const proof = JSON.parse(
      await fs.readFile(out + "/database-rehearse.json", "utf8"),
    );
    const recovery = JSON.parse(
      await fs.readFile(out + "/recovery-snapshot.json", "utf8"),
    );
    assert(proof.passed && proof.hash === hash);
    assert(
      recovery.readbackVerified === true && recovery.projectRef === projectRef,
    );
    assert(
      Date.now() - Date.parse(recovery.at) < 24 * 60 * 60 * 1000,
      "Refresh the recovery snapshot",
    );
  }
  let receipt: unknown;
  try {
    await sql.begin(async (tx) => {
      await tx`set local lock_timeout='5s'`;
      await tx`set local statement_timeout='60s'`;
      const snapshot = async () => {
        const data: Record<string, unknown> = {};
        for (const table of [
          "credits_sandbox.state",
          "beta_fantasy.cards",
          "beta_fantasy.ownership_events",
          "beta_fantasy.entries",
          "beta_fantasy.results",
          "beta_fantasy.competitions",
          "beta_fantasy.round_drafts",
          "beta_fantasy.slot_locks",
          "beta_fantasy.sales",
          "beta_fantasy.packs",
          "sports_feed.sport_sandbox_inventory",
          "sports_feed.nfl_control",
        ])
          data[table] = (
            await tx.unsafe(
              `select count(*) count,md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by md5(to_jsonb(t)::text)),'')) hash from ${table} t`,
            )
          )[0];
        return data;
      };
      const before = await snapshot();
      if (mode === "apply") {
        const definitions = [];
        for (const f of [
          "sports_feed.rarity_inventory(uuid)",
          "sports_feed.lineup_inventory(uuid,uuid)",
          "sports_feed.sport_sandbox_state(text)",
        ])
          definitions.push(
            (
              await tx`select pg_get_functiondef(${f}::regprocedure) definition`
            )[0].definition,
          );
        await fs.mkdir("private-data/play-owned", { recursive: true });
        const stamp = Date.now();
        await fs.writeFile(
          `private-data/play-owned/rollback-${stamp}.sql`,
          "begin;\nset local lock_timeout='5s';\n" +
            definitions.join(";\n") +
            ";\ncommit;\n",
          { flag: "wx", mode: 0o600 },
        );
        await fs.writeFile(
          `private-data/play-owned/preimage-${stamp}.json`,
          JSON.stringify({ hash, before }),
          { flag: "wx", mode: 0o600 },
        );
      }
      if (mode !== "verify") await tx.unsafe(body);
      if (mode === "rehearse") await tx.unsafe(body);
      for (const role of [
        "anon",
        "authenticated",
        "service_role",
        "docked_app",
        "docked_beta_app",
      ])
        for (const f of [
          "sports_feed.owned_sport_inventory(uuid,text)",
          "sports_feed.rarity_inventory(uuid)",
          "sports_feed.lineup_inventory(uuid,uuid)",
        ])
          assert.equal(
            (
              await tx`select has_function_privilege(${role},${f},'EXECUTE') ok`
            )[0].ok,
            false,
          );
      assert.equal(
        (
          await tx`select has_function_privilege('docked_beta_app','sports_feed.sport_sandbox_state(text)','EXECUTE') ok`
        )[0].ok,
        true,
      );
      const measurements = [];
      for (const a of await tx`select user_id,label from credits_sandbox.access where enabled order by label`) {
        for (const sport of ["basketball", "afl", "nrl"]) {
          const start = performance.now();
          const cards = (
            await tx`select sports_feed.owned_sport_inventory(${a.user_id}::uuid,${sport}) cards`
          )[0].cards;
          // Independent ownership membership check; no impersonated member session.
          for (const card of cards) {
            const owned = (
              await tx`select exists(select 1 from credits_sandbox.state where document->'commerce'->'cards'->${card.id}->>'owner'=${a.user_id} and document->'commerce'->'cards'->${card.id}->>'sport'=${sport}) or exists(select 1 from beta_fantasy.cards where id::text=${card.id} and owner_id=${a.user_id}::uuid) ok`
            )[0].ok;
            assert(owned);
          }
          measurements.push({
            account: a.label,
            sport,
            ownedCards: cards.length,
            readAndValidationMs: Math.round(performance.now() - start),
          });
        }
      }
      assert.deepEqual(await snapshot(), before, "Protected records changed");
      if (mode === "apply")
        await tx`insert into supabase_migrations.schema_migrations(version,name,statements)values('20261023052447','play_owned_inventory',${[body]}) on conflict do nothing`;
      receipt = {
        passed: true,
        mode,
        hash,
        at: new Date().toISOString(),
        projectRef,
        protectedRecords: before,
        ownershipWrites: 0,
        walletWrites: 0,
        measurements,
        verificationScope:
          "Owner SQL diagnostics, not authenticated browser acceptance",
        rollback:
          "Restore saved function definitions from private-data/play-owned and promote captured prior application. No data rollback necessary.",
      };
      if (mode === "rehearse") throw Error("ROLLBACK_REHEARSAL");
    });
  } catch (e) {
    if (!(
      mode === "rehearse" &&
      e instanceof Error &&
      e.message === "ROLLBACK_REHEARSAL"
    ))
      throw e;
  }
  await fs.writeFile(
    out + `/database-${mode}.json`,
    JSON.stringify(receipt, null, 2),
  );
  console.log(JSON.stringify({ passed: true, mode, hash }));
} finally {
  await sql.end();
}

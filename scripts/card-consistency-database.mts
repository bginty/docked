import fs from "node:fs/promises";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { ownerDatabase, projectRef } from "./owner-gameplay-db.mjs";
const root = process.cwd(),
  out = root + "/docs/qa/card-consistency/release";
const file = "20261023130000_nba_private_beta_rarity_v2.sql";
const body = await fs.readFile(root + "/supabase/migrations/" + file, "utf8"),
  hash = createHash("sha256").update(body).digest("hex");
const mode = process.argv[2];
assert(["rehearse", "apply", "verify"].includes(mode));
process.chdir("C:/Users/61412/Documents/ChatGPT/Docked.com.au");
assert.equal(projectRef, "pojoymtniryarxxunyvz");
await fs.mkdir(out, { recursive: true });
await fs.mkdir("private-data/card-consistency", { recursive: true });
const sql = ownerDatabase();
const protectedTables = [
  "beta_fantasy.cards",
  "beta_fantasy.entries",
  "beta_fantasy.results",
  "beta_fantasy.ownership_events",
  "beta_fantasy.sales",
  "credits_sandbox.state",
  "sports_feed.nfl_rounds",
  "sports_feed.nfl_control",
  "beta_fantasy.players",
  "sports_feed.sport_sandbox_inventory",
];
try {
  const previous =
    mode === "apply"
      ? JSON.parse(await fs.readFile(out + "/database-rehearse.json", "utf8"))
      : null;
  if (previous) {
    assert.equal(previous.passed, true);
    assert.equal(previous.hash, hash);
  }
  let receipt: unknown;
  try {
    await sql.begin(async (tx) => {
      await tx`select pg_advisory_xact_lock(71022026)`;
      await tx`set local lock_timeout='10s'`;
      await tx`set local statement_timeout='60s'`;
      const snapshot = async () => {
        const data: Record<string, unknown> = {};
        for (const table of protectedTables)
          data[table] = (
            await tx.unsafe(
              `select count(*) count,md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by md5(to_jsonb(t)::text)),'')) hash from ${table} t`,
            )
          )[0];
        data.nflCompetitions = (
          await tx`select md5(coalesce(string_agg(to_jsonb(c)::text,'' order by c.id),'')) hash from beta_fantasy.competitions c where sport='nfl'`
        )[0];
        return data;
      };
      const before = await snapshot();
      const old =
        await tx`select id,rules,scoring_id,locks_at from beta_fantasy.competitions where sport='basketball'`;
      if (mode === "apply")
        await fs.writeFile(
          "private-data/card-consistency/preimage-" + Date.now() + ".json",
          JSON.stringify({ before, old }),
          { flag: "wx", mode: 0o600 },
        );
      if (mode !== "verify") await tx.unsafe(body);
      assert.deepEqual(await snapshot(), before, "Protected records changed");
      const changed =
        await tx`select id,rules->>'scoring_version' version from beta_fantasy.competitions where sport='basketball' order by id`;
      const retained = await tx`select id,rules,scoring_id,locks_at from beta_fantasy.competitions where sport='basketball' and id=any(${old.map(c => c.id)}::uuid[]) order by id`;
      assert.deepEqual([...retained], [...old].sort((a,b) => a.id.localeCompare(b.id)), "Existing NBA competition changed");
      if (mode === "rehearse") {
        await tx.unsafe(body);
        assert.deepEqual(await tx`select id,rules->>'scoring_version' version from beta_fantasy.competitions where sport='basketball' order by id`, changed, "Migration replay created duplicate rounds");
      }
      const count = changed.filter(
        (c) =>
          old.find((o) => o.id === c.id)?.rules.scoring_version !== c.version,
      ).length;
      if (mode === "apply")
        await tx`insert into supabase_migrations.schema_migrations(version,name,statements)values('20261023130000','nba_private_beta_rarity_v2',${[body]}) on conflict do nothing`;
      receipt = {
        passed: true,
        mode,
        hash,
        projectRef,
        at: new Date().toISOString(),
        createdSuccessorRounds: count,
        versions: changed,
        protectedRecords: before,
        existingSelectionsPreserved: true,
        resultsRecalculated: false,
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
    out + "/database-" + mode + ".json",
    JSON.stringify(receipt, null, 2),
  );
  console.log(JSON.stringify({ passed: true, mode, hash }));
} finally {
  await sql.end();
}

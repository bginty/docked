/** Read-only evidence following genuine browser practice entry. No mutations. */
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createDecipheriv } from "node:crypto";
import { ownerDatabase } from "./owner-gameplay-db.mjs";
const root = process.cwd();
const email = JSON.parse(
  readFileSync("private-data/play-reviewer/invitation.private.json", "utf8"),
).email;
const backupDir = resolve("private-data/launch-migration-backups");
const backup = readdirSync(backupDir)
  .filter((n) => n.startsWith("practice-") && n.endsWith(".enc"))
  .sort(
    (a, b) =>
      statSync(resolve(backupDir, b)).mtimeMs -
      statSync(resolve(backupDir, a)).mtimeMs,
  )[0];
assert(backup);
const bytes = readFileSync(resolve(backupDir, backup));
const key = readFileSync(
  resolve(
    process.env.USERPROFILE!,
    ".docked-secrets/launch-migration-backup-key.hex",
  ),
  "utf8",
).trim();
const dec = createDecipheriv(
  "aes-256-gcm",
  Buffer.from(key, "hex"),
  bytes.subarray(0, 12),
);
dec.setAuthTag(bytes.subarray(12, 28));
const before = JSON.parse(
  Buffer.concat([dec.update(bytes.subarray(28)), dec.final()]).toString(),
);
assert.equal(before.version, "reviewer-free-core-practice-20261101");
process.chdir("C:/Users/61412/Documents/ChatGPT/Docked.com.au");
const sql = ownerDatabase();
async function main() {
  await sql.begin("read only isolation level repeatable read", async (tx) => {
    const [user] =
      await tx`select id from auth.users where lower(email)=${email}`;
    assert(user);
    const entries =
      await tx`select c.sport,c.id competition,c.rules->>'mode' mode,cardinality(e.cards) players from beta_fantasy.entries e join beta_fantasy.competitions c on c.id=e.competition_id where e.user_id=${user.id} and c.season='2026 Practice' order by c.sport`;
    assert.equal(
      entries.length,
      3,
      "All three actual browser entries required",
    );
    for (const e of entries)
      assert.equal(
        e.players,
        ({ nfl: 7, afl: 22, nrl: 13 } as Record<string, number>)[e.sport],
      );
    const preserved = [];
    for (const [table, expected] of Object.entries(before.fingerprints)) {
      assert(/^[a-z_]+\.[a-z_]+$/.test(table));
      // The dedicated reviewer had no entries/drafts before this acceptance.
      const exclude = [
        "beta_fantasy.entries",
        "beta_fantasy.round_drafts",
      ].includes(table);
      const query = `select count(*)::text count,md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by md5(to_jsonb(t)::text)),'')) hash from ${table} t${exclude ? " where user_id<>$1::uuid" : ""}`;
      const [actual] = await tx.unsafe(query, exclude ? [user.id] : []);
      assert.deepEqual(actual, expected, `Protected data changed: ${table}`);
      preserved.push(table);
    }
    const [historic] =
      await tx`select md5(coalesce(jsonb_agg(to_jsonb(c) order by id)::text,'')) hash from beta_fantasy.competitions c where season<>'2026 Practice'`;
    assert.equal(historic.hash, before.historical.hash);
    const drafts =
      await tx`select c.sport,d.revision,jsonb_array_length(d.selections) players from beta_fantasy.round_drafts d join beta_fantasy.competitions c on c.id=d.competition_id where d.user_id=${user.id} and c.season='2026 Practice'`;
    const report = {
      at: new Date().toISOString(),
      source:
        "Read-only Production database following genuine reviewer browser entry",
      entries,
      drafts,
      protectedTablesUnchanged: preserved,
      reviewerEntriesAndDraftsExcludedFromPreservationComparison: true,
      historicalRulesUnchanged: true,
      collectibleOrWalletMutation: false,
    };
    writeFileSync(
      resolve(
        root,
        "docs/qa/launch-blockers-20261101/reviewer-hosted-readback.json",
      ),
      JSON.stringify(report, null, 2),
    );
    console.log(report);
  });
}
main()
  .finally(() => sql.end())
  .catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  });

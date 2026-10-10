import assert from "node:assert/strict";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import postgres from "postgres";
import { createHash } from "node:crypto";
import { ScoringStore } from "../src/server/scoring-store";
import {
  saveTeam,
  lockTeams,
  importStatistics,
  finalise,
  results,
  digest,
} from "../src/core/scoring-engine";
import {
  syntheticScenario,
  scenarioTimes as t,
} from "../src/core/scoring-synthetic";
import { sports } from "../src/core/scoring-v1";

async function main() {
  const url = process.env.FANTASY_TEST_DATABASE_URL ?? "";
  if (
    !/^postgres:\/\/[^@]+@127\.0\.0\.1:\d+\/docked_free_play_test_\d+$/.test(
      url,
    )
  )
    throw Error("Disposable loopback PostgreSQL only");
  const sql = postgres(url, { max: 20 });
  const operator = { id: "synthetic-reviewer", role: "reviewer" as const };
  const migration =
    "supabase/migrations/20261010092154_scoring_v1_isolated_journal.sql";
  try {
    await sql.unsafe(
      "create role anon; create role authenticated; create role docked_beta_app; create role scoring_fixture_reader;",
    );
    await sql.unsafe(await readFile(migration, "utf8"));
    // Sentinel schemas prove this new pipeline never writes card/reward/live records.
    await sql.unsafe(
      "create schema fantasy;create table fantasy.official_sentinel(value text);insert into fantasy.official_sentinel values('unchanged official inventory, ownership, rewards, records');",
    );
    const store = new ScoringStore(sql);
    const demo: Record<string, unknown> = {};
    const checks: string[] = [];
    for (const sport of sports) {
      const f = syntheticScenario(sport),
        id = f.state.period.id;
      await store.create(f.state);
      const conflicting = structuredClone(f.state);
      conflicting.period.id += "-conflicting-rules";
      conflicting.period.rules.weights.goals = 999;
      await assert.rejects(
        () => store.create(conflicting),
        /Rules version already registered/,
      );
      for (const owner of ["amber", "violet"])
        await store.change(id, (s) =>
          saveTeam(
            s,
            owner,
            owner === "amber"
              ? "Synthetic team Amber"
              : "Synthetic team Violet",
            f.catalog.filter((c) => c.owner === owner).map((c) => c.cardId),
            f.catalog,
            t.save,
          ),
        );
      await store.change(id, (s) => lockTeams(s, f.catalog, t.lock));
      const pending = results(await store.read(id));
      const lockedHash = digest((await store.read(id)).entries);
      await assert.rejects(
        () =>
          store.change(id, (s) =>
            saveTeam(s, "amber", "Edited", [], f.catalog, t.initial),
          ),
        /locked/,
      );
      await assert.rejects(
        () =>
          store.change(id, (s) => ({
            ...s,
            period: { ...s.period, label: "changed" },
          })),
        /Immutable/,
      );
      const start = Number(
        (
          await sql`select count(*) n from scoring_beta.journal where stream_id=${id}`
        )[0].n,
      );
      await Promise.all(
        Array.from({ length: 20 }, () =>
          store.change(id, (s) =>
            importStatistics(s, f.source, operator, t.initial),
          ),
        ),
      );
      assert.equal(
        Number(
          (
            await sql`select count(*) n from scoring_beta.journal where stream_id=${id}`
          )[0].n,
        ),
        start + 1,
      );
      const initial = results(await store.read(id));
      assert.equal(initial.rows[0].member, "amber");
      // After-lock trades/position edits in today's catalogue cannot alter saved history.
      f.catalog.forEach((c) => {
        c.owner = "another-owner";
        c.position = "changed";
      });
      await Promise.all(
        Array.from({ length: 20 }, () =>
          store.change(id, (s) =>
            importStatistics(s, f.correction, operator, t.corrected),
          ),
        ),
      );
      const corrected = results(await store.read(id));
      assert.equal(corrected.rows[0].member, "violet");
      assert.equal(digest((await store.read(id)).entries), lockedHash);
      assert.equal((await store.read(id)).sources.length, 2);
      // Throw after calculation: the transaction must not append a result.
      const beforeFailure = digest(await store.read(id));
      await assert.rejects(
        () =>
          store.change(id, (s) => {
            importStatistics(
              s,
              { ...f.correction, revision: 3 },
              operator,
              t.corrected,
            );
            throw Error("injected persistence failure");
          }),
        /injected/,
      );
      assert.equal(digest(await store.read(id)), beforeFailure);
      await store.change(id, (s) => finalise(s, operator, t.final));
      const final = results(await store.read(id));
      assert.equal(final.rows[0].status, "final");
      const chain =
        await sql`select revision,previous_hash,state_hash,body,calculated from scoring_beta.journal where stream_id=${id} order by revision`;
      chain.forEach((r, i) => {
        assert.equal(r.previous_hash, i ? chain[i - 1].state_hash : "");
        assert.equal(r.state_hash, digest(r.body));
        assert.equal(digest(r.calculated), digest(results(r.body)));
      });
      demo[sport] = {
        rules: f.state.period.rules,
        pending,
        initial,
        corrected,
        final,
        audits: (await store.read(id)).audits,
      };
      checks.push(
        `${sport}: 2 locked teams; 20-way duplicate import; 20-way correction; standings reverse; history unchanged after trade; failure rollback; finalisation; stored breakdown/hash replay`,
      );
    }
    for (const role of [
      "anon",
      "authenticated",
      "docked_beta_app",
      "scoring_fixture_reader",
    ]) {
      await assert.rejects(
        () =>
          sql.begin(async (tx) => {
            await tx.unsafe(`set local role ${role}`);
            await tx.unsafe(
              "insert into scoring_beta.streams(id,sport,rules_version) values ('sim:forged','epl','docked-epl-beta-v1')",
            );
          }),
        /permission denied/,
      );
      await assert.rejects(
        () =>
          sql.begin(async (tx) => {
            await tx.unsafe(`set local role ${role}`);
            await tx.unsafe("select * from scoring_beta.journal");
          }),
        /permission denied/,
      );
    }
    await assert.rejects(
      () => sql.unsafe("update scoring_beta.journal set calculated='{}'"),
      /append only/,
    );
    await assert.rejects(
      () => sql.unsafe("delete from scoring_beta.journal"),
      /append only/,
    );
    assert.equal(
      (await sql`select value from fantasy.official_sentinel`)[0].value,
      "unchanged official inventory, ownership, rewards, records",
    );
    checks.push(
      "Four unprivileged roles denied read/write; immutable history; official sentinel unchanged",
    );
    await mkdir("docs/qa/scoring-v1", { recursive: true });
    await writeFile(
      "config/scoring-demo.json",
      JSON.stringify(demo, null, 2) + "\n",
    );
    await writeFile(
      "docs/qa/scoring-v1/real-postgres.json",
      JSON.stringify(
        {
          testedAt: new Date().toISOString(),
          engine: (await sql`select version()`)[0].version,
          simulatedOnly: true,
          migration,
          migrationHash: createHash("sha256")
            .update(
              (await readFile(migration, "utf8")).replaceAll("\r\n", "\n"),
            )
            .digest("hex"),
          migrationHashEncoding: "SHA256 of UTF-8 SQL normalized to LF",
          checks,
        },
        null,
        2,
      ) + "\n",
    );
    console.log(
      JSON.stringify({ pass: true, sports: sports.length, checks }, null, 2),
    );
  } finally {
    await sql.end();
  }
}
main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Scoring test failed");
  process.exitCode = 1;
});

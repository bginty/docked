// Additive beta-only read model. Never changes Auth, cards, supplies or results.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createHash, randomUUID } from "node:crypto";
import assert from "node:assert/strict";
import {
  ownerDatabase,
  ownerRuntimeDatabase,
  projectRef,
} from "./owner-gameplay-db.mjs";
const mode = process.argv[2];
assert.ok(["--dry-run", "--apply", "--verify"].includes(mode));
const migration = "20261010072625_fantasy_play_read_model.sql";
const source = readFileSync(
  "supabase/migrations/" + migration,
  "utf8",
).replaceAll("\r\n", "\n");
const hash = (v) => createHash("sha256").update(v).digest("hex");
const sql = ownerDatabase(),
  app = ownerRuntimeDatabase();
const owner = JSON.parse(
  readFileSync("private-data/owner-gameplay/owner.json", "utf8"),
).id;
const report = {
  at: new Date().toISOString(),
  mode,
  projectRef,
  migration,
  sha256: hash(source),
  checks: [],
  passed: false,
};
const rollback = Error("READ_MODEL_DRY_RUN");
async function snapshot(tx) {
  const data = [];
  for (const t of await tx`select schemaname,tablename from pg_tables where schemaname in('public','private','fantasy','beta_fantasy') order by 1,2`) {
    assert.match(t.tablename, /^[a-z0-9_]+$/);
    data.push({
      table: t.schemaname + "." + t.tablename,
      ...(
        await tx.unsafe(
          `select count(*)::int n,md5(coalesce(string_agg(to_jsonb(t)::text,E'\n' order by to_jsonb(t)::text),'')) digest from ${t.schemaname}.${t.tablename} t`,
        )
      )[0],
    });
  }
  return hash(JSON.stringify(data));
}
try {
  const session = (
    await sql`select id from auth.sessions where user_id=${owner} and aal='aal2' and (not_after is null or not_after>clock_timestamp()) order by created_at desc limit 1`
  )[0]?.id;
  assert.ok(
    session,
    "Existing owner AAL2 session required; do not reset login",
  );
  const context = async (tx, id = owner, aal = "aal2") => {
    await tx`select set_config('request.jwt.claim.sub',${id},true),set_config('request.jwt.claims',${JSON.stringify({ sub: id, session_id: session, aal })},true),set_config('docked.fantasy_channel','beta',true),set_config('docked.fantasy_production',${projectRef},true)`;
  };
  if (mode !== "--verify") {
    if (mode === "--apply") {
      const dry = JSON.parse(
        readFileSync("docs/qa/fantasy-ux/read-model-dry-run.json", "utf8"),
      );
      assert.equal(dry.passed, true);
      assert.equal(dry.sha256, hash(source));
    }
    try {
      await sql.begin(async (tx) => {
        assert.equal(
          (
            await tx`select testers_enabled from beta_private.admission_control`
          )[0].testers_enabled,
          false,
        );
        assert.equal(
          (
            await tx`select enabled,owner_id from beta_private.owner_gameplay_control`
          )[0].owner_id,
          owner,
        );
        const before = await snapshot(tx);
        await tx.unsafe(source);
        await context(tx);
        const state = (
          await tx`select beta_fantasy.production_read_state() s`
        )[0].s;
        assert.ok(state.server_time);
        assert.ok(state.round_details?.length > 0);
        for (const round of state.round_details) {
          assert.equal(round.cards.length, 11);
          assert.ok(round.cards.every((c) => c.owner_id === owner));
          for (const score of round.scores)
            assert.equal(typeof score.score, "number");
        }
        assert.equal(await snapshot(tx), before);
        report.checks.push(
          "Existing owner read includes only own immutable snapshots and scores",
          "All official and beta fantasy table hashes unchanged",
          "External admission remains closed",
        );
        if (mode === "--dry-run") throw rollback;
        await tx`insert into supabase_migrations.schema_migrations(version,name,statements) values('20261010072625','fantasy_play_read_model',${[source]})`;
      });
    } catch (e) {
      if (e !== rollback) throw e;
    }
  }
  if (mode === "--verify") {
    const read = (id = owner, aal = "aal2") =>
      app.begin(async (tx) => {
        await context(tx, id, aal);
        return (await tx`select beta_fantasy.production_read_state() s`)[0].s;
      });
    const state = await read();
    assert.ok(state.round_details.length);
    assert.ok(state.server_time);
    const open = state.competitions.find(
      (c) => !c.scored_at && Date.parse(c.locks_at) > Date.now(),
    );
    assert.ok(open, "Existing QA open round required");
    const cards = state.cards
      .filter((c) => c.sport === "football" && c.season === open.season)
      .map((c) => c.id);
    const before = await snapshot(sql);
    await assert.rejects(
      () =>
        app.begin(async (tx) => {
          await context(tx);
          const key = randomUUID(),
            payload = { competition_id: open.id, cards };
          const first = (
            await tx`select beta_fantasy.production_command('save_lineup',${tx.json(payload)},${key}) r`
          )[0].r;
          assert.deepEqual(
            (
              await tx`select beta_fantasy.production_command('save_lineup',${tx.json(payload)},${key}) r`
            )[0].r,
            first,
          );
          const saved = (
            await tx`select beta_fantasy.production_read_state() s`
          )[0].s;
          assert.equal(
            saved.entries.find((e) => e.competition_id === open.id).cards
              .length,
            11,
          );
          assert.equal(
            saved.round_details.find((e) => e.competition_id === open.id).cards
              .length,
            11,
          );
          throw Error("QA_ENTRY_ROLLBACK");
        }),
      /QA_ENTRY_ROLLBACK/,
    );
    await assert.rejects(
      () =>
        app.begin(async (tx) => {
          await context(tx);
          await tx`select beta_fantasy.production_command('save_lineup',${tx.json({ competition_id: open.id, cards: [randomUUID(), ...cards.slice(1)] })},${randomUUID()})`;
        }),
      /owned|eligib|card/i,
    );
    const locked = state.competitions.find(
      (c) => Date.parse(c.locks_at) <= Date.now(),
    );
    await assert.rejects(
      () =>
        app.begin(async (tx) => {
          await context(tx);
          await tx`select beta_fantasy.production_command('save_lineup',${tx.json({ competition_id: locked.id, cards })},${randomUUID()})`;
        }),
      /lock|closed|scor/i,
    );
    assert.equal(await snapshot(sql), before);
    report.checks.push(
      "Hosted owned XI save, idempotent retry and snapshot read pass inside rolled-back QA transaction",
      "Foreign card and locked-round changes denied",
      "All official and beta fantasy table hashes unchanged after transaction tests",
    );
    await assert.rejects(() => read(randomUUID()), /owner|MFA|session/i);
    await assert.rejects(() => read(owner, "aal1"), /MFA/i);
    await assert.rejects(
      () => app`select beta_fantasy.production_read_state_before_field()`,
      /permission/,
    );
    await assert.rejects(
      () => app`select * from beta_fantasy.round_scores`,
      /permission/,
    );
    await assert.rejects(
      () => app`update beta_fantasy.cards set serial=serial`,
      /permission/,
    );
    assert.equal(
      (await sql`select to_regnamespace('market_sandbox') n`)[0].n,
      null,
    );
    writeFileSync(
      "private-data/owner-gameplay/hosted-state.json",
      JSON.stringify(state, null, 2),
    );
    report.checks.push(
      "Restricted hosted runtime owner read passed",
      "Non-owner and AAL1 denied",
      "Old wrapper and direct score/card access denied",
      "Sandbox transaction schema absent from hosted DB",
      "Fresh private QA snapshot saved",
    );
  }
  report.passed = true;
} finally {
  await Promise.all([sql.end({ timeout: 5 }), app.end({ timeout: 5 })]);
  mkdirSync("docs/qa/fantasy-ux", { recursive: true });
  writeFileSync(
    `docs/qa/fantasy-ux/read-model-${mode.slice(2)}.json`,
    JSON.stringify(report, null, 2) + "\n",
  );
}
console.log(JSON.stringify(report));

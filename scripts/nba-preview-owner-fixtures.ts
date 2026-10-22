// Explicit owner-only fictional inventory; never mints permanent cards.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import assert from "node:assert/strict";
import postgres from "postgres";
import {
  nbaWeeklyLineup,
  nbaWeeklyRules,
  freezeNbaWeek,
} from "../src/core/nba-weekly";
async function main() {
  const root = process.argv[2];
  assert(root && process.argv[3] === "--prepare-owner-testing");
  const c = JSON.parse(
    await readFile(
      root + "/private-data/hosted-preview/connection.json",
      "utf8",
    ),
  );
  assert.equal(c.projectRef, "bckkllmndoxzpzdqrevb");
  const owner = JSON.parse(
    await readFile(
      root + "/private-data/private-preview-release/owner.private.json",
      "utf8",
    ),
  );
  assert.equal(owner.email, "support@docked.com.au");
  const u = new URL(c.databaseUrl);
  assert.equal(u.username, "postgres.bckkllmndoxzpzdqrevb");
  assert(u.hostname.endsWith(".pooler.supabase.com"));
  assert.equal(u.port, "5432");
  const db = postgres(c.databaseUrl, {
    max: 1,
    prepare: false,
    connect_timeout: 12,
    onnotice: () => {},
    ssl: {
      rejectUnauthorized: true,
      ca: await readFile(root + "/certs/supabase-prod-ca-2021.crt", "utf8"),
    },
  });
  try {
    const result = await db.begin(async (tx) => {
      await tx`select pg_advisory_xact_lock(71022026)`;
      assert.equal(
        (
          await tx`select id from auth.users where id=${owner.id} and email=${owner.email}`
        ).length,
        1,
        "Existing configured owner identity required",
      );
      assert.equal(
        (await tx`select enabled from beta_private.admission_control`)[0]
          .enabled,
        false,
      );
      assert.equal(
        (
          await tx`select version from supabase_migrations.schema_migrations where version='20261022053636'`
        ).length,
        1,
      );
      const cfg = nbaWeeklyLineup();
      const existing =
        await tx`select configuration from beta_fantasy.lineup_configurations where version=${cfg.version}`;
      if (existing.length) assert.deepEqual(existing[0].configuration, cfg);
      else
        await tx`insert into beta_fantasy.lineup_configurations(version,configuration)values(${cfg.version},${tx.json(cfg)})`;
      const rules = nbaWeeklyRules();
      await tx`insert into beta_fantasy.scoring_rules(version,rules)values(${rules.version},${tx.json(rules)}) on conflict(version)do nothing`;
      const [scoring] =
        await tx`select id,rules from beta_fantasy.scoring_rules where version=${rules.version}`;
      assert.deepEqual(scoring.rules, rules);
      await tx`insert into sports_feed.sport_sandbox_access(user_id)values(${owner.id}) on conflict do nothing`;
      await tx`insert into beta_fantasy.members(user_id,expires_at)values(${owner.id},'2027-10-22') on conflict do nothing`;
      let cards = (
        await tx`select cards from sports_feed.sport_sandbox_inventory where user_id=${owner.id} and sport='basketball'`
      )[0]?.cards;
      if (!cards) {
        cards = [...cfg.slots, ...cfg.slots].map((s, i) => ({
          id: randomUUID(),
          player_id: randomUUID(),
          owner_id: owner.id,
          name: `QA NBA Owner ${i + 1}`,
          team: "Fictional laboratory",
          sport: "basketball",
          position: s.positions[0],
          eligible_positions: s.positions,
          status: "active",
          listed: false,
          tier:
            i < 8
              ? "CORE"
              : ["RARE", "ELITE", "ULTRA_RARE", "LEGENDARY", "ICON"][i % 5],
          serial: 1,
          max_supply: 0,
          season: "QA 2026",
          verifiedJerseyNumber: null,
        }));
        await tx`insert into sports_feed.sport_sandbox_inventory(user_id,sport,cards)values(${owner.id},'basketball',${tx.json(cards)})`;
      }
      assert(
        cards.every(
          (x: { owner_id: string; name: string }) =>
            x.owner_id === owner.id && x.name.startsWith("QA NBA Owner "),
        ),
        "Do not replace existing inventory",
      );
      let created = 0;
      for (const [week, monday, start] of [
        [1, "2026-10-26", "2026-10-27T00:00:00Z"],
        [2, "2026-11-02", "2026-11-03T00:00:00Z"],
        [3, "2026-11-09", "2026-11-10T00:00:00Z"],
      ] as const) {
        for (const mode of ["OPEN", "SALARY_CAP"]) {
          const name = `QA NBA protected owner ${mode} ${monday}`;
          if (
            (
              await tx`select id from beta_fantasy.competitions where name=${name} and sport='basketball' and rules->>'lineup_version'=${cfg.version}`
            ).length
          )
            continue;
          const id = randomUUID();
          const fixtures = [0, 1].map((i) => ({
            id: `sim:basketball:${id}:${i}`,
            scheduledAt: new Date(
              Date.parse(start) + i * 86400000,
            ).toISOString(),
            playerIds: cards.map((x: { player_id: string }) => x.player_id),
            status: "scheduled",
          }));
          const frozen = freezeNbaWeek(monday, fixtures, {
            complete: true,
            previouslyAssigned: {},
          });
          await tx`insert into beta_fantasy.competitions(id,name,sport,season,round,locks_at,rules,scoring_id,prize)values(${id},${name},'basketball','QA-NBA-2026',${week},${frozen.locksAt},${tx.json({ mode, lineup_version: cfg.version, inventory_scope: cfg.inventoryScope, lock_policy: "round-wide-v1", scoring_version: rules.version, synthetic: true, owner_testing_approval: "nba-owner-protected-testing-2026-10-22" })},${scoring.id},'No cash prize')`;
          await tx`insert into sports_feed.sport_rounds(competition_id,sport,fixtures)values(${id},'basketball',${tx.json(fixtures.map((f) => ({ fixtureId: f.id, scheduledAt: f.scheduledAt, status: f.status, playerIds: f.playerIds })))})`;
          created++;
        }
      }
      await tx`insert into beta_private.audit_events(actor,action,subject,details)values('owner-authorised-protected-acceptance','nba_owner_test_fixtures_prepared',${owner.id},${tx.json({ approval: "nba-owner-protected-testing-2026-10-22", createdRounds: created, permanentCardsIssued: 0, memberAdmission: false, mfaBypass: false })})`;
      return {
        project: c.projectRef,
        createdRounds: created,
        fictionalInventoryRecords: cards.length,
        permanentCardsIssued: 0,
        memberAdmission: false,
        mfaStillRequired: true,
        production: false,
      };
    });
    await mkdir("docs/qa/multi-sport/nba-acceptance", { recursive: true });
    await writeFile(
      "docs/qa/multi-sport/nba-acceptance/owner-fixtures.json",
      JSON.stringify(result, null, 2),
    );
    console.log(JSON.stringify(result));
  } finally {
    await db.end({ timeout: 2 });
  }
}
main().catch((e) => {
  console.error({
    failed: true,
    code: e.code ?? "OWNER_FIXTURE_RECONCILIATION_REQUIRED",
    constraint: e.constraint_name,
    table: e.table_name,
  });
  process.exitCode = 1;
});

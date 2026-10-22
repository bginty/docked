import { writeFile, mkdir } from "node:fs/promises";
import { randomUUID, createHash } from "node:crypto";
import assert from "node:assert/strict";
import { DateTime } from "luxon";
import { ownerDatabase, projectRef } from "./owner-gameplay-db.mjs";
import {
  nbaWeeklyLineup,
  nbaWeeklyRules,
  freezeNbaWeek,
} from "../src/core/nba-weekly";
const root = "C:/Users/61412/.codex/worktrees/fixed-market-live/Docked.com.au";
process.chdir("C:/Users/61412/Documents/ChatGPT/Docked.com.au");
assert.equal(process.argv[2], "--prepare-private-beta");
const ids = {
  Owner: "623d1e69-d0f3-493f-9713-108e8c21469a",
  Barry: "ef641248-67be-4c32-9b12-9205bfcee15b",
  Luke: "9fa5cdbb-aa2e-4ebe-9f2c-de9885233cd3",
  Brenton: "d6ab4838-7108-4c50-8ab8-c5947ab55bd8",
};
const authority =
  "Owner request: Deploy NBA to Production for Private Beta Testing, 22 October 2026; fictional testing only, no permanent issuance, money or provider activation.";
const sql = ownerDatabase();
try {
  const result = await sql.begin(async (tx) => {
    await tx`select pg_advisory_xact_lock(71022026)`;
    assert.equal(
      (
        await tx`select version from supabase_migrations.schema_migrations where version='20261022101445'`
      ).length,
      1,
    );
    const untouched = async () =>
      (
        await tx`select md5(document::text) hash from credits_sandbox.state where id`
      )[0].hash;
    const wallet = await untouched();
    const cfg = nbaWeeklyLineup(),
      rules = nbaWeeklyRules();
    await tx`insert into beta_fantasy.lineup_configurations(version,configuration)values(${cfg.version},${tx.json(cfg)}) on conflict do nothing`;
    assert.deepEqual(
      (
        await tx`select configuration from beta_fantasy.lineup_configurations where version=${cfg.version}`
      )[0].configuration,
      cfg,
    );
    await tx`insert into beta_fantasy.scoring_rules(version,rules)values(${rules.version},${tx.json(rules)}) on conflict do nothing`;
    const scoring = (
      await tx`select id,rules from beta_fantasy.scoring_rules where version=${rules.version}`
    )[0];
    assert.deepEqual(scoring.rules, rules);
    const players = Array.from({ length: 24 }, (_, i) => {
      const hex = createHash("sha256")
        .update(`nba-private-test-v1-player-${i}`)
        .digest("hex");
      return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
    });
    const testers = [];
    for (const [label, id] of Object.entries(ids)) {
      const [account] =
        await tx`select a.email_confirmed_at is not null confirmed,p.disabled_at,
    exists(select 1 from beta_private.friends_roster where user_id=a.id and enabled and email=lower(a.email)) invited,
    exists(select 1 from beta_private.owner_gameplay_control where owner_id=a.id and enabled) owner,
    beta_private.gameplay_mfa_required(a.id) mfa_required
    from auth.users a left join beta_public.profiles p on p.id=a.id where a.id=${id}`;
      assert(
        account && (account.invited || account.owner) && !account.disabled_at,
        "Existing authorised account required",
      );
      if (label === "Owner") assert(account.owner);
      await tx`insert into sports_feed.sport_sandbox_access(user_id)values(${id}) on conflict do nothing`;
      await tx`insert into sports_feed.nba_beta_access(user_id,enabled,authority,expires_at)values(${id},true,${authority},'2027-01-31T00:00:00Z') on conflict do nothing`;
      const cards = players.map((player_id, i) => ({
        id: randomUUID(),
        player_id,
        canonical_player_id: player_id,
        owner_id: id,
        name: `Test NBA Player ${String(i + 1).padStart(2, "0")}`,
        team: "Fictional NBA testing",
        sport: "basketball",
        position: cfg.slots[i % 8].positions[0],
        eligible_positions: cfg.slots[i % 8].positions,
        status: "active",
        listed: false,
        tier:
          i < 8
            ? "CORE"
            : ["RARE", "ELITE", "ULTRA_RARE", "LEGENDARY", "ICON"][i % 5],
        serial: 1,
        max_supply: 0,
        season: "TEST 2026",
        verifiedJerseyNumber: null,
      }));
      await tx`insert into sports_feed.sport_sandbox_inventory(user_id,sport,cards)values(${id},'basketball',${tx.json(cards)}) on conflict do nothing`;
      testers.push({
        label,
        id,
        emailConfirmed: account.confirmed,
        mfaRequired: account.mfa_required,
        allowlisted: true,
        canAuthenticate: account.confirmed,
      });
    }
    const first = DateTime.now().setZone("America/New_York").startOf("week");
    let created = 0;
    for (let week = 0; week < 5; week++)
      for (const mode of ["OPEN", "SALARY_CAP"]) {
        const monday = first.plus({ weeks: week }),
          key = monday.toISODate()!;
        const name = `NBA TEST ${mode} ${key}`;
        if (
          (
            await tx`select id from beta_fantasy.competitions where name=${name} and sport='basketball'`
          ).length
        )
          continue;
        // Current test week has a future Friday/Saturday pair, then future weeks Mon/Wed/Fri.
        const days = week === 0 ? [4, 5] : [0, 2, 4];
        const times = days.map((day) =>
          monday.plus({ days: day, hours: 19 }).toUTC().toISO()!,
        );
        assert(
          times.every((t) => Date.parse(t) > Date.now()),
          "Current testing week has passed; explicitly review a new fixture window",
        );
        const id = randomUUID();
        const fixtures = times.map((scheduledAt, i) => ({
          id: `sim:basketball:${id}:${i}`,
          scheduledAt,
          playerIds: players,
          status: "scheduled",
        }));
        const frozen = freezeNbaWeek(key, fixtures, {
          complete: true,
          previouslyAssigned: {},
        });
        await tx`select set_config('docked.multi_sport','isolated-preview',true)`;
        await tx`insert into beta_fantasy.competitions(id,name,sport,season,round,locks_at,rules,scoring_id,prize) values(${id},${name},'basketball','NBA-PRIVATE-TEST-2026',${week + 1},${frozen.locksAt},${tx.json({ mode, lineup_version: cfg.version, inventory_scope: cfg.inventoryScope, lock_policy: "round-wide-v1", scoring_version: rules.version, synthetic: true, nba_beta_scope: "private-test-v1", authority })},${scoring.id},'No cash prize')`;
        await tx`insert into sports_feed.sport_rounds(competition_id,sport,fixtures)values(${id},'basketball',${tx.json(fixtures.map((f) => ({ fixtureId: f.id, scheduledAt: f.scheduledAt, status: f.status, playerIds: f.playerIds })))})`;
        created++;
      }
    await tx`insert into sports_feed.nba_beta_control(id,enabled,authority)values(true,true,${authority}) on conflict do nothing`;
    await tx`insert into beta_private.audit_events(actor,action,subject,details)values('owner-authorised-nba-private-beta','nba_private_testing_prepared','basketball',${tx.json({ testers: Object.values(ids), roundsCreated: created, permanentCards: 0, provider: false, financial: false })})`;
    assert.equal(await untouched(), wallet);
    return {
      projectRef,
      testers,
      roundsCreated: created,
      inventoryPerTester: 24,
      permanentCardsIssued: 0,
      entriesSubmitted: 0,
      walletUnchanged: true,
      realData: false,
    };
  });
  await mkdir(root + "/docs/qa/nba-private-beta-live", { recursive: true });
  await writeFile(
    root + "/docs/qa/nba-private-beta-live/fixtures.json",
    JSON.stringify(result, null, 2),
  );
  console.log(JSON.stringify(result));
} catch (e) {
  console.error({
    failed: true,
    code: (e as { code?: string }).code ?? "FAILED",
    message: e instanceof Error ? e.message : "Unknown",
  });
  process.exitCode = 1;
} finally {
  await sql.end({ timeout: 3 });
}

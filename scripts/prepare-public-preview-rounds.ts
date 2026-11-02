/** Verified, dated roster practice on the existing protected Preview only.
 * No Production writer, invented official match, collectible issuance or awards. */
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { createHash, randomUUID } from "node:crypto";
import postgres from "postgres";
import { approvedAustralianLineup } from "../src/core/approved-australian-rules";
import { nflSeven } from "../src/core/nfl-seven";
const dir = "private-data/restored-public-preview";
const c = JSON.parse(
  readFileSync(
    "C:/Users/61412/Documents/ChatGPT/Docked.com.au/private-data/hosted-preview/connection.json",
    "utf8",
  ),
);
assert.equal(c.projectRef, "bckkllmndoxzpzdqrevb");
assert.equal(new URL(c.databaseUrl).username, "postgres.bckkllmndoxzpzdqrevb");
assert.equal(process.argv[2], "--prepare-protected-preview");
const s = postgres(c.databaseUrl, {
  max: 1,
  ssl: {
    rejectUnauthorized: true,
    ca: readFileSync("certs/supabase-prod-ca-2021.crt", "utf8"),
  },
  onnotice: () => {},
});
const version = "public-roster-practice-20261102-v1",
  season = "2026 Roster Practice",
  deadline = "2026-11-08T12:00:00.000Z";
const nfl = JSON.parse(
  readFileSync(dir + "/nfl-verified-readonly.json", "utf8"),
);
const aus = JSON.parse(
  readFileSync(
    "public/data/rosters/wikimedia-roster-beta-2026-10-23-v1.json",
    "utf8",
  ),
).players.filter((p: { sport: string }) => ["afl", "nrl"].includes(p.sport));
const snapshots = JSON.parse(
  readFileSync(dir + "/public-rule-snapshots.json", "utf8"),
);
const sha = (v: unknown) =>
  createHash("sha256").update(JSON.stringify(v)).digest("hex");
const result: {
  at: string;
  version: string;
  season: string;
  deadline: string;
  rounds: Record<string, string[]>;
  counts: Record<string, number>;
  preserved: boolean;
  productionWrites: number;
  officialFixtures: boolean;
  previewOnly: boolean;
} = {
  at: new Date().toISOString(),
  version,
  season,
  deadline,
  rounds: {},
  counts: {},
  preserved: false,
  productionWrites: 0,
  officialFixtures: false,
  previewOnly: true,
};
async function main() {
  try {
    await s.begin(async (t) => {
      await t`set local lock_timeout='5s'`;
      await t`set local statement_timeout='90s'`;
      await t`select pg_advisory_xact_lock(202611020347::bigint)`;
      assert(Date.parse(deadline) > Date.now());
      assert(nfl.length > 100 && aus.length > 700);
      assert(
        nfl.every(
          (p: { checked_at: string }) =>
            Date.parse(p.checked_at) > Date.now() - 72 * 3600000,
        ),
        "Fresh NFL evidence required",
      );
      const protectedTables = [
        "auth.users",
        "public.profiles",
        "credits_sandbox.state",
        "credits_sandbox.card_instances",
        "credits_sandbox.journal",
        "commercial_billing.cards",
        "commercial_billing.lots",
        "commercial_billing.receipts",
        "beta_fantasy.entries",
        "beta_fantasy.round_drafts",
        "beta_fantasy.results",
        "beta_fantasy.ownership_events",
      ];
      const fingerprint = async (name: string) =>
        (
          await t.unsafe(
            `select md5(coalesce(string_agg(md5(to_jsonb(x)::text),'' order by md5(to_jsonb(x)::text)),'')) hash from ${name} x`,
          )
        )[0].hash;
      const before = Object.fromEntries(
        await Promise.all(
          protectedTables.map(async (p) => [p, await fingerprint(p)]),
        ),
      );
      const [historical] =
        await t`select md5(coalesce(jsonb_agg(to_jsonb(c) order by id)::text,'')) hash from beta_fantasy.competitions c where rules->>'public_template_version' is distinct from ${version}`;
      await t`insert into beta_fantasy.players(id,name,sport,position,team,colour,shirt,first_season,status) select p.id,p.name,'nfl',p.position,p.team,p.colour,p.shirt,p.first_season,'active' from jsonb_to_recordset(${t.json(nfl)}) p(id uuid,name text,position text,team text,colour text,shirt integer,first_season text) on conflict(id) do nothing`;
      await t`insert into sports_feed.free_core_roster select p.id,'nfl',${season},jsonb_build_array(p.position),${deadline},p.source_url,p.source_hash,true from jsonb_to_recordset(${t.json(nfl)}) p(id uuid,position text,source_url text,source_hash text) on conflict(player_id) do nothing`;
      assert.equal(
        (
          await t`select bool_and(credits_sandbox.is_roster_beta_player(value)) ok from jsonb_array_elements(${t.json(aus)})`
        )[0].ok,
        true,
      );
      await t`insert into credits_sandbox.nba_fixture_players(id,identity) select value->>'id',value from jsonb_array_elements(${t.json(aus)}) on conflict(id) do nothing`;
      await t`insert into sports_feed.free_core_roster_beta select value->>'id',value->>'sport',${season},value->'eligiblePositions',${deadline},value#>>'{rosterBeta,sourceHash}',true from jsonb_array_elements(${t.json(aus)}) on conflict(provider_player_id) do nothing`;
      for (const sport of ["nfl", "afl", "nrl"] as const) {
        const config =
          sport === "nfl"
            ? {
                ...nflSeven,
                version: "public-nfl-round-wide-practice-v1",
                lockPolicy: "round-wide-v1",
                salaryUnit: "fantasy-dollars",
              }
            : approvedAustralianLineup(sport);
        const source = snapshots.find(
          (x: { sport: string }) => x.sport === sport,
        );
        assert(source);
        const ids =
          sport === "nfl"
            ? nfl.map((p: { id: string }) => p.id)
            : aus
                .filter((p: { sport: string }) => p.sport === sport)
                .map((p: { fixturePlayerId: string }) => p.fixturePlayerId);
        const eligible =
          sport === "nfl"
            ? nfl.map((p: { id: string; position: string }) => ({
                id: p.id,
                positions: [p.position],
              }))
            : aus
                .filter((p: { sport: string }) => p.sport === sport)
                .map(
                  (p: {
                    fixturePlayerId: string;
                    eligiblePositions: string[];
                  }) => ({
                    id: p.fixturePlayerId,
                    positions: p.eligiblePositions,
                  }),
                );
        // Matching, not just budget arithmetic: augmenting paths support multi-position players.
        const assigned = new Map<string, number>();
        const visit = (slot: number, seen: Set<string>): boolean => {
          for (const p of eligible) {
            if (
              seen.has(p.id) ||
              !p.positions.some((pos: string) =>
                config.slots[slot].positions.includes(pos),
              )
            )
              continue;
            seen.add(p.id);
            const old = assigned.get(p.id);
            if (old === undefined || visit(old, seen)) {
              assigned.set(p.id, slot);
              return true;
            }
          }
          return false;
        };
        assert(
          config.slots.every((_, i) => visit(i, new Set())),
          sport + " positional feasibility",
        );
        assert(config.slots.length * config.salaries.CORE <= config.salaryCap);
        await t`insert into beta_fantasy.lineup_configurations(version,configuration) values(${config.version},${t.json(config)}) on conflict do nothing`;
        const [saved] =
          await t`select configuration from beta_fantasy.lineup_configurations where version=${config.version}`;
        assert.deepEqual(saved.configuration, config);
        await t`insert into beta_fantasy.scoring_rules(version,rules) values(${source.scoring_version},${t.json(source.scoring_rules)}) on conflict do nothing`;
        const [scoring] =
          await t`select id,rules from beta_fantasy.scoring_rules where version=${source.scoring_version}`;
        assert.deepEqual(scoring.rules, source.scoring_rules);
        result.rounds[sport] = [];
        result.counts[sport] = ids.length;
        for (const mode of ["SALARY_CAP", "OPEN"]) {
          const rules = {
            ...source.rules,
            mode,
            lineup_version: config.version,
            scoring_version: source.scoring_version,
            inventory_scope: config.inventoryScope,
            free_core_policy: "public-free-core-v1",
            public_access_policy: "au-adult-free-play-v1",
            entry_fee_credits: 0,
            lock_policy: "round-wide-v1",
            public_template_version: version,
            synthetic: true,
            round_reward_policy: {
              version: "public-no-prizes-v1",
              active: false,
              items: [],
              tiePolicy: null,
            },
          };
          const [old] =
            await t`select id,rules from beta_fantasy.competitions where sport=${sport} and season=${season} and rules->>'mode'=${mode} and rules->>'public_template_version'=${version}`;
          const id = old?.id ?? randomUUID();
          if (old) assert.deepEqual(old.rules, rules);
          else {
            await t`insert into beta_fantasy.competitions(id,name,sport,season,round,locks_at,rules,scoring_id,prize,awards) values(${id},${sport.toUpperCase() + " Roster Practice · " + (mode === "OPEN" ? "All-Star" : "Traditional")},${sport},${season},1,${deadline},${t.json(rules)},${scoring.id},'No cash prize','[]')`;
            const fixture = [
              {
                fixtureId: version + ":" + sport + ":" + mode,
                scheduledAt: deadline,
                status: "scheduled",
                playerIds: ids,
                synthetic: true,
                label:
                  "Practice selection deadline. Dated verified roster; no official match or results.",
              },
            ];
            await t`insert into public_gameplay.rounds(competition_id,sport,enabled,rules_hash,fixtures,fixture_kind,source_reference) select id,sport,true,md5(rules::text),${t.json(fixture)},'practice',${"Dated source roster practice; " + version + "; source package " + sha(eligible)} from beta_fantasy.competitions where id=${id}`;
          }
          result.rounds[sport].push(id);
        }
      }
      for (const p of protectedTables)
        assert.equal(await fingerprint(p), before[p], p);
      const [after] =
        await t`select md5(coalesce(jsonb_agg(to_jsonb(c) order by id)::text,'')) hash from beta_fantasy.competitions c where rules->>'public_template_version' is distinct from ${version}`;
      assert.equal(after.hash, historical.hash);
      assert.equal(
        (
          await t`select sales_enabled or issuance_enabled or transfers_enabled active from commercial_billing.control where id`
        )[0].active,
        false,
      );
      result.preserved = true;
    });
    writeFileSync(
      dir + "/verified-rounds.private.json",
      JSON.stringify(result, null, 2),
    );
    writeFileSync(
      "docs/qa/launch-convergence-20261102/public-roster-rounds.json",
      JSON.stringify(result, null, 2),
    );
    console.log(JSON.stringify(result));
  } finally {
    await s.end();
  }
}
main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});

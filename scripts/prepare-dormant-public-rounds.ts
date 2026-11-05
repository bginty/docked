/** Default is a read-only plan. Explicit owner-authorised apply only prepares
 * disabled public mappings. Existing accounts, eligibility and rules stay intact. */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { ownerDatabase } from "./owner-gameplay-db.mjs";
import {
  publicPracticeLineup,
  publicPracticeRules,
} from "../src/core/public-practice-configuration";
import type { PublicSport } from "../src/core/public-customer";

const root = process.cwd(),
  mode = process.argv[2] ?? "--plan";
assert(["--plan", "--apply-owner-authorised-dormant"].includes(mode));
const dir = "private-data/public-configuration-20261105";
const out = "docs/qa/public-configuration-20261105";
mkdirSync(dir, { recursive: true });
mkdirSync(out, { recursive: true });
const template = JSON.parse(
  readFileSync("config/public-practice-rounds.json", "utf8"),
);
assert.deepEqual(template.sports, ["nfl", "afl", "nrl"]);
assert.deepEqual(template.modes, ["SALARY_CAP", "OPEN"]);
assert.equal(template.productionEnabled, false);
assert.equal(template.prizesEnabled, false);
assert.equal(template.entryFeeCredits, 0);
assert(Date.parse(template.deadline) > Date.now());
const snapshots = JSON.parse(
  readFileSync(
    "private-data/restored-public-preview/public-rule-snapshots.json",
    "utf8",
  ),
);
const hash = (s: string) => createHash("sha256").update(s).digest("hex");
const literal = (v: unknown) => "'" + String(v).replaceAll("'", "''") + "'";
process.chdir("C:/Users/61412/Documents/ChatGPT/Docked.com.au");
const sql = ownerDatabase();
process.chdir(root);
const protectedTables = [
  "auth.users",
  "public.profiles",
  "beta_public.profiles",
  "private.consent_events",
  "beta_private.consent_events",
  "private.feature_flags",
  "public_gameplay.policy",
  "public_gameplay.sports",
  "sports_feed.free_core_programmes",
  "sports_feed.free_core_roster",
  "sports_feed.free_core_roster_beta",
  "credits_sandbox.state",
  "credits_sandbox.card_instances",
  "credits_sandbox.pack_receipts",
  "credits_sandbox.journal",
  "beta_fantasy.cards",
  "beta_fantasy.packs",
  "beta_fantasy.pack_items",
  "beta_fantasy.entries",
  "beta_fantasy.round_drafts",
  "beta_fantasy.slot_locks",
  "beta_fantasy.results",
  "beta_fantasy.ownership_events",
  "beta_fantasy.sales",
  "commercial_billing.control",
  "commercial_billing.accounts",
  "commercial_billing.receipts",
  "commercial_billing.journals",
  "commercial_billing.lots",
  "commercial_billing.cards",
  "commercial_billing.packs",
  "commercial_billing.recovery_cases",
  "sports_feed.nfl_rounds",
  "sports_feed.sport_rounds",
  "beta_fantasy.production_rounds",
  "cron.job",
];
type Player = {
  id: string;
  sport: PublicSport;
  season: string;
  positions: string[];
};
async function main() {
  try {
    if (mode === "--plan") {
      const relations =
        await sql`select name,to_regclass(name) present from jsonb_array_elements_text(${sql.json(protectedTables)}) n(name)`;
      for (const relation of relations)
        assert(
          relation.present,
          `Protected relation missing: ${relation.name}`,
        );
      const players = await sql.begin(
        "read only",
        async (t) => t<Player[]>`
        select p.id::text id,r.sport,r.season,r.eligible_positions positions from sports_feed.free_core_roster r join beta_fantasy.players p on p.id=r.player_id where r.active and r.valid_until>${template.deadline}::timestamptz and p.status='active'
        union all select p.identity->>'fixturePlayerId',r.sport,r.season,r.eligible_positions from sports_feed.free_core_roster_beta r join credits_sandbox.nba_fixture_players p on p.id=r.provider_player_id where r.active and r.valid_until>${template.deadline}::timestamptz and p.identity->>'status'='active' and credits_sandbox.is_roster_beta_player(p.identity) order by 2,1`,
      );
      const seasons = [...new Set(players.map((p) => p.season))];
      assert.deepEqual(
        seasons,
        ["2026 Practice"],
        "Preserve the existing shared reviewer roster season",
      );
      const season = seasons[0],
        rounds = [];
      for (const sport of template.sports as PublicSport[]) {
        const lineup = publicPracticeLineup(sport),
          eligible = players.filter((p) => p.sport === sport);
        assert(eligible.length > 100);
        assert.equal(new Set(eligible.map((p) => p.id)).size, eligible.length);
        const assigned = new Map<string, number>();
        const visit = (slot: number, seen: Set<string>): boolean => {
          for (const p of eligible) {
            if (
              seen.has(p.id) ||
              !p.positions.some((pos) =>
                lineup.slots[slot].positions.includes(pos),
              )
            )
              continue;
            seen.add(p.id);
            const previous = assigned.get(p.id);
            if (previous === undefined || visit(previous, seen)) {
              assigned.set(p.id, slot);
              return true;
            }
          }
          return false;
        };
        assert(
          lineup.slots.every((_, i) => visit(i, new Set())),
          sport + " positional feasibility",
        );
        assert(lineup.slots.length * lineup.salaries.CORE <= lineup.salaryCap);
        const source = snapshots.find(
          (s: { sport: string }) => s.sport === sport,
        );
        assert(source);
        const corePlayers = [...assigned]
          .sort((a, b) => a[1] - b[1])
          .map(([player, slot]) => ({ slot: lineup.slots[slot].id, player }));
        for (const competitionMode of template.modes as (
          "SALARY_CAP" | "OPEN"
        )[])
          rounds.push({
            sport,
            mode: competitionMode,
            lineup,
            corePlayers,
            rules: publicPracticeRules(
              source,
              sport,
              competitionMode,
              template.version,
              "Owner-authorised dormant public preparation, 5 November 2026. Dated verified roster snapshot practice only; no official fixtures, activation, entry fee, prizes or collectible issuance.",
            ),
            scoringVersion: source.scoring_version,
            scoringRules: source.scoring_rules,
            name: `${sport.toUpperCase()} Roster Practice · ${competitionMode === "OPEN" ? "All-Star" : "Traditional"}`,
            fixtures: [
              {
                fixtureId: `${template.version}:${sport}:${competitionMode}`,
                scheduledAt: template.deadline,
                status: "scheduled",
                playerIds: eligible.map((p) => p.id),
                synthetic: true,
                label:
                  "Practice selection deadline. Recorded roster snapshot; no official match or results.",
              },
            ],
            sourceReference: `Dated recorded roster practice; ${template.version}; roster SHA-256 ${hash(JSON.stringify(eligible))}`,
          });
      }
      const model = {
        version: template.version,
        season,
        round: template.round,
        deadline: template.deadline,
        players,
        rounds,
      };
      const modelJson = JSON.stringify(model);
      const program = `do $docked_public$ declare model jsonb:=${literal(modelJson)}::jsonb; item jsonb; cid uuid; sid uuid; prior beta_fantasy.competitions; before_hash jsonb:='{}'; h text; rel text; historical text; begin
perform pg_advisory_xact_lock(202611020347::bigint);
if (model->>'deadline')::timestamptz<=clock_timestamp() then raise exception 'Fresh future deadline required'; end if;
if exists(select 1 from public_gameplay.policy where enabled) or exists(select 1 from public_gameplay.sports where visible or play_enabled) or exists(select 1 from private.feature_flags where key='registration' and enabled) or exists(select 1 from commercial_billing.control where sales_enabled or issuance_enabled or transfers_enabled or gameplay_enabled) then raise exception 'All public and economic activation must remain off'; end if;
if exists(select 1 from jsonb_array_elements(model->'players') p where case when p.value->>'sport'='nfl' then not exists(select 1 from sports_feed.free_core_roster r join beta_fantasy.players player on player.id=r.player_id where r.player_id::text=p.value->>'id' and r.season=model->>'season' and r.active and r.valid_until>(model->>'deadline')::timestamptz and r.eligible_positions=p.value->'positions' and player.status='active') else not exists(select 1 from sports_feed.free_core_roster_beta r join credits_sandbox.nba_fixture_players player on player.id=r.provider_player_id where player.identity->>'fixturePlayerId'=p.value->>'id' and r.sport=p.value->>'sport' and r.season=model->>'season' and r.active and r.valid_until>(model->>'deadline')::timestamptz and r.eligible_positions=p.value->'positions' and player.identity->>'status'='active' and credits_sandbox.is_roster_beta_player(player.identity)) end) then raise exception 'Recorded roster eligibility changed after reviewed plan'; end if;
foreach rel in array array[${protectedTables.map(literal).join(",")}] loop execute format('select md5(coalesce(string_agg(md5(to_jsonb(x)::text),'''' order by md5(to_jsonb(x)::text)),'''')) from %s x',rel) into h; before_hash:=before_hash||jsonb_build_object(rel,h); end loop;
select md5(coalesce(jsonb_agg(to_jsonb(c) order by id)::text,'')) into historical from beta_fantasy.competitions c where c.rules->>'public_template_version' is distinct from model->>'version';
for item in select value from jsonb_array_elements(model->'rounds') loop
insert into beta_fantasy.lineup_configurations(version,configuration) values(item#>>'{lineup,version}',item->'lineup') on conflict do nothing;
if not exists(select 1 from beta_fantasy.lineup_configurations where version=item#>>'{lineup,version}' and configuration=item->'lineup') then raise exception 'Saved lineup configuration conflict'; end if;
select id into strict sid from beta_fantasy.scoring_rules where version=item->>'scoringVersion' and rules=item->'scoringRules';
if (select count(*) from beta_fantasy.competitions where sport=item->>'sport' and season=model->>'season' and rules->>'mode'=item->>'mode' and rules->>'public_template_version'=model->>'version')>1 then raise exception 'Duplicate public template'; end if;
select * into prior from beta_fantasy.competitions where sport=item->>'sport' and season=model->>'season' and rules->>'mode'=item->>'mode' and rules->>'public_template_version'=model->>'version';
if found then if prior.rules<>item->'rules' or prior.locks_at<>(model->>'deadline')::timestamptz or prior.scoring_id<>sid or prior.name<>item->>'name' then raise exception 'Existing public competition differs'; end if; cid:=prior.id;
else insert into beta_fantasy.competitions(id,name,sport,season,round,locks_at,rules,scoring_id,prize,awards) values(gen_random_uuid(),item->>'name',item->>'sport',model->>'season',(model->>'round')::int,(model->>'deadline')::timestamptz,item->'rules',sid,'No cash prize','[]') returning id into cid; end if;
insert into public_gameplay.rounds(competition_id,sport,enabled,rules_hash,fixtures,fixture_kind,source_reference) select id,sport,false,md5(rules::text),item->'fixtures','practice',item->>'sourceReference' from beta_fantasy.competitions where id=cid on conflict do nothing;
if not exists(select 1 from public_gameplay.rounds r join beta_fantasy.competitions c on c.id=r.competition_id where c.id=cid and not r.enabled and r.rules_hash=md5(c.rules::text) and r.fixtures=item->'fixtures' and r.source_reference=item->>'sourceReference') then raise exception 'Public binding differs or is active'; end if;
if exists(select 1 from sports_feed.sport_rounds where competition_id=cid) or exists(select 1 from beta_fantasy.production_rounds where competition_id=cid) then raise exception 'Public round must not be published in beta'; end if;
end loop;
if (select count(*) from public_gameplay.rounds r join beta_fantasy.competitions c on c.id=r.competition_id where c.rules->>'public_template_version'=model->>'version')<>6 then raise exception 'Exactly six public mappings required'; end if;
foreach rel in array array[${protectedTables.map(literal).join(",")}] loop execute format('select md5(coalesce(string_agg(md5(to_jsonb(x)::text),'''' order by md5(to_jsonb(x)::text)),'''')) from %s x',rel) into h; if h<>before_hash->>rel then raise exception 'Protected records changed: %',rel; end if; end loop;
if historical is distinct from (select md5(coalesce(jsonb_agg(to_jsonb(c) order by id)::text,'')) from beta_fantasy.competitions c where c.rules->>'public_template_version' is distinct from model->>'version') then raise exception 'Historical competitions changed'; end if;
end $docked_public$;`;
      writeFileSync(dir + "/plan.private.json", modelJson, { mode: 0o600 });
      writeFileSync(dir + "/prepare.sql", program, { mode: 0o600 });
      const report = {
        at: new Date().toISOString(),
        mode,
        project: "pojoymtniryarxxunyvz",
        version: model.version,
        season,
        deadline: model.deadline,
        sqlSha256: hash(program),
        newCompetitions: 6,
        newDisabledPublicMappings: 6,
        eligibilityRowsChanged: 0,
        programmeChanges: 0,
        publicPolicyChanges: 0,
        registrationChanges: 0,
        billingChanges: 0,
        prizes: false,
        officialFixtures: false,
        datedRosterPractice: true,
        rounds: rounds.map((r) => ({
          sport: r.sport,
          mode: r.mode,
          players: r.lineup.slots.length,
          rosterPlayers: r.fixtures[0].playerIds.length,
          salaryCap: r.mode === "SALARY_CAP" ? r.lineup.salaryCap : null,
          coreSalary: r.lineup.salaries.CORE,
          positionalFeasibility: true,
        })),
        productionWrites: 0,
      };
      writeFileSync(out + "/plan.json", JSON.stringify(report, null, 2));
      console.log(JSON.stringify(report));
      return;
    }
    const plan = JSON.parse(readFileSync(out + "/plan.json", "utf8")),
      program = readFileSync(dir + "/prepare.sql", "utf8");
    assert.equal(hash(program), plan.sqlSha256);
    const rehearsal = JSON.parse(readFileSync(out + "/rehearsal.json", "utf8"));
    assert.equal(rehearsal.sqlSha256, plan.sqlSha256);
    assert.equal(rehearsal.passed, true);
    const restored = JSON.parse(
      readFileSync(out + "/restore/restore-drill.json", "utf8"),
    );
    assert.equal(restored.sourceProject, "pojoymtniryarxxunyvz");
    assert.equal(restored.restored, true);
    assert.equal(restored.protectedRecordsUnchanged, true);
    const archive = JSON.parse(
      readFileSync(out + "/restore/archive-integrity.json", "utf8"),
    );
    assert.equal(archive.authenticated, true);
    assert.equal(archive.sha256Matches, true);
    assert.equal(archive.bytes, restored.archiveBytes);
    assert(Date.parse(restored.backupAt) > Date.now() - 2 * 3600000);
    const result = await sql.begin(
      "isolation level repeatable read",
      async (t) => {
        await t`set local lock_timeout='5s'`;
        await t`set local statement_timeout='120s'`;
        await t.unsafe(program);
        return t`select c.id,c.sport,c.name,c.season,c.round,c.locks_at,c.rules->>'mode' mode,c.rules->>'lineup_version' lineup_version,r.enabled,c.prize,c.awards from beta_fantasy.competitions c join public_gameplay.rounds r on r.competition_id=c.id where c.rules->>'public_template_version'=${plan.version} order by c.sport,mode`;
      },
    );
    const report = {
      at: new Date().toISOString(),
      mode,
      sqlSha256: plan.sqlSha256,
      rounds: result,
      allDisabled: result.every((r) => r.enabled === false),
      protectedDataUnchanged: true,
      historicalRulesUnchanged: true,
      eligibilityRowsChanged: 0,
      activationChanges: 0,
      migrations: [],
      passed: true,
    };
    writeFileSync(out + "/applied.json", JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report));
  } finally {
    await sql.end({ timeout: 5 });
  }
}
main().catch((e) => {
  console.error(
    e instanceof Error ? e.message : "Dormant public preparation failed",
  );
  process.exitCode = 1;
});

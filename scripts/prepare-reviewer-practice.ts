/** Owner-authorised no-prize reviewer configuration. No schema/ownership writes. */
import assert from "node:assert/strict";
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  randomUUID,
} from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { ownerDatabase } from "./owner-gameplay-db.mjs";
import { digest, results, type ScoringState } from "../src/core/scoring-engine";

const root = process.cwd(),
  mode = process.argv[2];
assert(
  ["--inspect", "--rehearse", "--apply-authorised-practice"].includes(mode),
);
const season = "2026 Practice",
  version = "reviewer-free-core-practice-20261101";
const authority =
  "Owner instruction 1 November 2026: genuine reviewer free-Core NFL/AFL/NRL gameplay in future editable no-prize practice competitions. Verified roster snapshot; no official fixtures, automatic statistics, permanent cards, payments or public admission.";
const { email } = JSON.parse(
  readFileSync(
    resolve(root, "private-data/play-reviewer/invitation.private.json"),
    "utf8",
  ),
);
process.chdir("C:/Users/61412/Documents/ChatGPT/Docked.com.au");
const sql = ownerDatabase();
const protectedTables = [
  "credits_sandbox.state",
  "credits_sandbox.card_instances",
  "credits_sandbox.journal",
  "beta_fantasy.cards",
  "beta_fantasy.entries",
  "beta_fantasy.round_drafts",
  "beta_fantasy.slot_locks",
  "beta_fantasy.prize_schedules",
  "sports_feed.private_beta_sports",
];
const hash = (v: string) => createHash("sha256").update(v).digest("hex");
let report: Record<string, unknown> = {};
const rehearsal = new Error("REHEARSAL_ROLLBACK");
async function main() {
  try {
    await sql.begin("isolation level repeatable read", async (tx) => {
      await tx`set local lock_timeout='5s'`;
      await tx`set local statement_timeout='90s'`;
      await tx`select pg_advisory_xact_lock(71820341)`;
      await tx`select pg_advisory_xact_lock(71820342)`;
      const [reviewer] =
        await tx`select u.id,beta_private.admitted(u.id) admitted,u.email_confirmed_at is not null confirmed from auth.users u where lower(u.email)=${email}`;
      assert(
        reviewer?.confirmed && reviewer.admitted,
        "Confirmed admitted nominated reviewer required",
      );
      const [access] =
        await tx`select expires_at from sports_feed.nba_beta_access where user_id=${reviewer.id} and enabled and expires_at>clock_timestamp()+interval '14 days'`;
      assert(access, "Existing reviewer programme access required");
      const until = new Date(access.expires_at).toISOString();
      const nfl =
        await tx`select p.id,p.name,p.position,p.team,r.source_url,r.source_hash,r.checked_at from beta_fantasy.players p join nfl_roster.current_evidence r on r.player_id=p.id::text where p.sport='nfl' and p.status='active' and r.identity_verified and r.status='active' and r.checked_at>clock_timestamp()-interval '72 hours' and p.position in ('QB','RB','WR','TE') and (p.position=any(string_to_array(r.position,'/')) or (p.position='RB' and r.position in ('HB','FB'))) order by p.id`;
      assert(nfl.length >= 50, "Fresh verified NFL roster required");
      const aus =
        await tx`select id,identity from credits_sandbox.nba_fixture_players where identity->>'sport' in ('afl','nrl') and identity->>'status'='active' and credits_sandbox.is_roster_beta_player(identity) order by id`;
      for (const sport of ["afl", "nrl"])
        assert(aus.filter((p) => p.identity.sport === sport).length > 100);
      const prior =
        await tx`select id,sport,rules from beta_fantasy.competitions where season=${season}`;
      assert(
        prior.every((c) => c.rules.review_practice_version === version),
        "Practice season conflict",
      );
      const fingerprints: Record<string, unknown> = {};
      const fingerprint = async (table: string) =>
        (
          await tx.unsafe(
            `select count(*)::text count,md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by md5(to_jsonb(t)::text)),'')) hash from ${table} t`,
          )
        )[0];
      for (const table of protectedTables)
        fingerprints[table] = await fingerprint(table);
      const [historical] =
        await tx`select md5(coalesce(jsonb_agg(to_jsonb(c) order by id)::text,'')) hash from beta_fantasy.competitions c where season<>${season}`;
      report = {
        at: new Date().toISOString(),
        mode,
        version,
        season,
        deadline: until,
        nflPlayers: nfl.length,
        aflPlayers: aus.filter((p) => p.identity.sport === "afl").length,
        nrlPlayers: aus.filter((p) => p.identity.sport === "nrl").length,
        priorRounds: prior.length,
        scope: authority,
      };
      if (mode === "--inspect") return;
      const backupRows =
        await tx`select jsonb_build_object('programmes',(select jsonb_agg(t) from sports_feed.free_core_programmes t),'roster',(select jsonb_agg(t) from sports_feed.free_core_roster t),'betaRoster',(select jsonb_agg(t) from sports_feed.free_core_roster_beta t)) data`;
      const key = readFileSync(
        resolve(
          process.env.USERPROFILE!,
          ".docked-secrets/launch-migration-backup-key.hex",
        ),
        "utf8",
      ).trim();
      const iv = randomBytes(12),
        cipher = createCipheriv("aes-256-gcm", Buffer.from(key, "hex"), iv),
        plain = JSON.stringify({
          version,
          backupRows,
          fingerprints,
          historical,
        });
      const encrypted = Buffer.concat([cipher.update(plain), cipher.final()]);
      const backup = resolve(
        root,
        `private-data/launch-migration-backups/practice-${hash(plain)}.enc`,
      );
        if (!existsSync(backup))
          writeFileSync(
            backup,
            Buffer.concat([iv, cipher.getAuthTag(), encrypted]),
            { flag: "wx", mode: 0o600 },
          );
      const saved = readFileSync(backup),
        decipher = createDecipheriv(
          "aes-256-gcm",
          Buffer.from(key, "hex"),
          saved.subarray(0, 12),
        );
      decipher.setAuthTag(saved.subarray(12, 28));
      assert.equal(
        Buffer.concat([
          decipher.update(saved.subarray(28)),
          decipher.final(),
        ]).toString(),
        plain,
      );
      // Evidence is a dated practice snapshot, not an assertion of future live roster membership.
      await tx`insert into sports_feed.free_core_roster(player_id,sport,season,eligible_positions,valid_until,source_url,source_hash,active) select p.id,'nfl',${season},jsonb_build_array(p.position),${until},p.source_url,p.source_hash,true from jsonb_to_recordset(${tx.json(nfl as never)}) p(id uuid,position text,source_url text,source_hash text) on conflict(player_id) do nothing`;
      await tx`insert into sports_feed.free_core_roster_beta(provider_player_id,sport,season,eligible_positions,valid_until,source_hash,active) select p.id,p.identity->>'sport',${season},p.identity->'eligiblePositions',${until},p.identity#>>'{rosterBeta,sourceHash}',true from jsonb_to_recordset(${tx.json(aus as never)}) p(id text,identity jsonb) on conflict(provider_player_id) do nothing`;
      const rounds = [];
      for (const sport of ["nfl", "afl", "nrl"]) {
        const [template] =
          await tx`select * from beta_fantasy.competitions where sport=${sport} and rules->>'mode'='SALARY_CAP' and season<>${season} order by locks_at desc limit 1`;
        assert(template);
        const lineup =
          sport === "nfl"
            ? "nfl-seven-test-v1"
            : `docked-australian-owner-2026-10-24-v1-${sport}`;
        const [config] =
          await tx`select configuration from beta_fantasy.lineup_configurations where version=${lineup}`;
        assert(config);
        const ids =
          sport === "nfl"
            ? nfl.map((p) => p.id)
            : aus
                .filter((p) => p.identity.sport === sport)
                .map((p) => p.identity.fixturePlayerId);
        assert.equal(new Set(ids).size, ids.length);
        for (const competitionMode of ["SALARY_CAP", "OPEN"]) {
          const rules = {
            ...template.rules,
            mode: competitionMode,
            lineup_version: lineup,
            free_core_policy: "public-free-core-v1",
            review_practice_version: version,
            synthetic: true,
            lock_policy: "round-wide-v1",
            authority,
            round_reward_policy: {
              version: "review-practice-no-prizes-v1",
              active: false,
              items: [],
              tiePolicy: null,
            },
          };
          const [existing] =
            await tx`select id,rules from beta_fantasy.competitions where sport=${sport} and season=${season} and round=1 and rules->>'mode'=${competitionMode}`;
          if (existing) {
            assert.equal(digest(existing.rules), digest(rules));
            rounds.push({
              sport,
              mode: competitionMode,
              id: existing.id,
              existing: true,
            });
            continue;
          }
          const cid = randomUUID(),
            fixtureId = `practice:${version}:${sport}:${competitionMode.toLowerCase()}`,
            name = `${sport.toUpperCase()} Practice · ${competitionMode === "OPEN" ? "All-Star" : "Traditional"} · no prizes`;
          const fixtures = [
            {
              fixtureId,
              scheduledAt: until,
              playerIds: ids,
              synthetic: true,
              label:
                "Practice selection deadline — no official match or results",
            },
          ];
          await tx`insert into beta_fantasy.competitions(id,name,sport,season,round,locks_at,rules,scoring_id,awards,prize) values(${cid},${name},${sport},${season},1,${until},${tx.json(rules)},${template.scoring_id},'[]','No cash prize')`;
          if (sport === "nfl") {
            const stream = `beta-real:qa:review-practice-20261101:${competitionMode.toLowerCase()}`;
            const [scoring] =
              await tx`select rules from beta_fantasy.scoring_rules where id=${template.scoring_id}`;
            const state: ScoringState = {
              schemaVersion: 1,
              scope: "authorised-free-beta",
              period: {
                id: stream,
                sport: "nfl",
                season,
                label: name,
                competitionMode: competitionMode as "SALARY_CAP" | "OPEN",
                lineupVersion: lineup,
                inventoryScope: "invited-nfl-test-v2",
                locksAt: until,
                rules: scoring.rules,
                fixtures: [
                  { id: fixtureId, scheduledAt: until, playerIds: ids },
                ],
              },
              entries: [],
              sources: [],
              lineupsLockedAt: null,
              finalisedAt: null,
              audits: [
                {
                  sequence: 1,
                  actor: "owner-authorised-reviewer-preparation",
                  action: "practice-created",
                  at: new Date().toISOString(),
                  reason: authority,
                  payloadHash: digest(ids),
                },
              ],
            };
            await tx`insert into sports_feed.streams(id,purpose,display_metadata) values(${stream},'historical-acceptance',${tx.json({ synthetic: true, label: name, source: "Existing verified roster snapshot; no official fixture" })})`;
            await tx`insert into sports_feed.journal(stream_id,revision,previous_hash,state_hash,body,calculated) values(${stream},1,'',${digest(state)},${tx.json(state as never)},${tx.json(results(state) as never)})`;
            await tx`insert into beta_fantasy.production_rounds(competition_id,release_channel) values(${cid},'beta')`;
            await tx`insert into sports_feed.nfl_rounds(competition_id,stream_id,purpose,fixtures,next_check) values(${cid},${stream},'member',${tx.json(fixtures)},'infinity')`;
          } else
            await tx`insert into sports_feed.sport_rounds(competition_id,sport,fixtures) values(${cid},${sport},${tx.json(fixtures)})`;
          await tx`insert into beta_fantasy.round_controls(competition_id,enabled,standings_visible) values(${cid},true,true)`;
          rounds.push({
            sport,
            mode: competitionMode,
            id: cid,
            existing: false,
          });
        }
      }
      await tx`update sports_feed.free_core_programmes set enabled=true where sport in ('nfl','afl','nrl') and not enabled`;
      for (const table of protectedTables)
        assert.deepEqual(
          await fingerprint(table),
          fingerprints[table],
          `${table} changed`,
        );
      assert.deepEqual(
        (
          await tx`select md5(coalesce(jsonb_agg(to_jsonb(c) order by id)::text,'')) hash from beta_fantasy.competitions c where season<>${season}`
        )[0],
        historical,
      );
      assert.equal(
        (
          await tx`select count(*)::int n from beta_fantasy.prize_schedules where season=${season}`
        )[0].n,
        0,
      );
      if (prior.length === 0)
        await tx`insert into beta_private.audit_events(actor,action,subject,details) values('owner-authorised-release-preparation','reviewer_free_core_practice_configured',${version},${tx.json({ authority, rounds, rosterSnapshot: true, collectiblesIssued: 0, prizes: false, publicRegistration: false })})`;
      report = {
        ...report,
        rounds,
        encryptedBackupVerified: true,
        protectedDataUnchanged: true,
        historicalRulesUnchanged: true,
        prizesEnabled: false,
        collectiblesIssued: 0,
      };
      if (mode === "--rehearse") throw rehearsal;
    });
  } catch (error) {
    if (error !== rehearsal) throw error;
    report.rehearsalRolledBack = true;
  } finally {
    await sql.end({ timeout: 2 });
  }
  mkdirSync(resolve(root, "docs/qa/launch-blockers-20261101"), {
    recursive: true,
  });
  writeFileSync(
    resolve(
      root,
      `docs/qa/launch-blockers-20261101/reviewer-practice-${mode.slice(2)}.json`,
    ),
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report, null, 2));
}
void main().catch((e) => {
  console.error(
    "Practice configuration failed; transaction rolled back",
    e.code ?? e.message,
  );
  process.exitCode = 1;
});

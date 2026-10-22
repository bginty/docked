// Reviewed, reversible private-test preparation. Does not issue permanent cards or fund wallets.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash, randomUUID } from "node:crypto";
import assert from "node:assert/strict";
import { DateTime } from "luxon";
import { ownerDatabase, projectRef } from "./owner-gameplay-db.mjs";
import {
  aflConfiguration,
  nrlConfiguration,
} from "../src/core/sport-configuration";
import { sandboxLineupConfiguration } from "../src/core/sport-sandbox-configuration";
import { sportEventRules } from "../src/core/sport-event-rules";
const root = process.cwd();
process.chdir("C:/Users/61412/Documents/ChatGPT/Docked.com.au");
assert.equal(projectRef, "pojoymtniryarxxunyvz");
const evidence = root + "/docs/qa/overnight-multisport/release";
await mkdir(evidence, { recursive: true });
const mode = process.argv[2];
assert(["prepare", "rehearse", "apply"].includes(mode));
const ids = [
  "623d1e69-d0f3-493f-9713-108e8c21469a",
  "ef641248-67be-4c32-9b12-9205bfcee15b",
  "9fa5cdbb-aa2e-4ebe-9f2c-de9885233cd3",
  "d6ab4838-7108-4c50-8ab8-c5947ab55bd8",
];
const authority =
  "Owner overnight multi-sport instruction: isolated fictional AFL/NRL private testing, provisional QA salary/scoring; no permanent issuance, cash prizes, licensed feeds or real-money activation.";
const uuid = (key: string) => {
  const h = createHash("sha256").update(key).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
};
if (mode === "prepare") {
  const start = DateTime.now()
    .setZone("Australia/Sydney")
    .startOf("day")
    .plus({ days: 1, hours: 19 });
  const manifest = {
    authority,
    testers: ids,
    sports: [aflConfiguration, nrlConfiguration].map((sport) => ({
      sport: sport.id,
      label: sport.label,
      config: sandboxLineupConfiguration(sport),
      rules: sportEventRules(sport.id as "afl" | "nrl"),
      players: Array.from({ length: sport.slots.length * 2 }, (_, i) => ({
        id: uuid(`${sport.id}-private-test-v1-player-${i}`),
        name: `Test ${sport.label} Player ${String(i + 1).padStart(2, "0")}`,
        position: sport.slots[i % sport.slots.length].positions[0],
        eligible_positions: sport.slots[i % sport.slots.length].positions,
      })),
      rounds: Array.from({ length: 5 }, (_, i) => ({
        round: i + 1,
        scheduledAt: start.plus({ weeks: i }).toUTC().toISO()!,
      })),
    })),
  };
  await writeFile(
    evidence + "/fixture-plan.json",
    JSON.stringify(manifest, null, 2),
    { flag: "wx" },
  );
  console.log(
    JSON.stringify({
      prepared: true,
      sports: manifest.sports.map((s) => ({
        sport: s.sport,
        players: s.players.length,
        rounds: s.rounds.length * 2,
      })),
      permanentCards: 0,
      creditChanges: 0,
    }),
  );
} else {
  const manifest = JSON.parse(
    await readFile(evidence + "/fixture-plan.json", "utf8"),
  );
  assert.equal(manifest.authority, authority);
  assert.deepEqual(manifest.testers, ids);
  const planHash = createHash("sha256")
    .update(JSON.stringify(manifest))
    .digest("hex");
  if (mode === "apply")
    assert.equal(
      JSON.parse(await readFile(evidence + "/fixture-rehearse.json", "utf8"))
        .planHash,
      planHash,
    );
  const sql = ownerDatabase();
  let receipt: unknown;
  try {
    try {
      await sql.begin(async (tx) => {
        await tx`select pg_advisory_xact_lock(71022026)`;
        assert.equal(
          (
            await tx`select version from supabase_migrations.schema_migrations where version='20261022124750'`
          ).length,
          1,
        );
        const snapshot = async () => {
          const a: Record<string, unknown> = {};
          for (const t of [
            "credits_sandbox.state",
            "beta_fantasy.cards",
            "beta_fantasy.entries",
            "beta_fantasy.results",
            "beta_fantasy.players",
            "beta_fantasy.sales",
            "sports_feed.nfl_control",
            "sports_feed.nfl_rounds",
          ])
            a[t] = (
              await tx.unsafe(
                `select count(*) n,md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by md5(to_jsonb(t)::text)),'')) hash from ${t} t`,
              )
            )[0];
          return a;
        };
        const before = await snapshot();
        let created = 0;
        const accounts = [];
        for (const id of ids) {
          const [u] =
            await tx`select a.email_confirmed_at is not null confirmed,not coalesce(a.is_anonymous,false) and (a.banned_until is null or a.banned_until<clock_timestamp()) valid, beta_private.beta_gameplay_identity(a.id) admitted,beta_private.gameplay_mfa_required(a.id) mfa_required from auth.users a join sports_feed.nba_beta_access b on b.user_id=a.id and b.enabled and b.expires_at>clock_timestamp() where a.id=${id}`;
          assert(u?.valid, "Existing allowlisted identity required");
          accounts.push({ id, ...u });
        }
        await tx`select set_config('docked.multi_sport','isolated-preview',true)`;
        for (const s of manifest.sports) {
          assert(["afl", "nrl"].includes(s.sport));
          await tx`insert into beta_fantasy.lineup_configurations values(${s.config.version},${tx.json(s.config)}) on conflict do nothing`;
          assert.deepEqual(
            (
              await tx`select configuration from beta_fantasy.lineup_configurations where version=${s.config.version}`
            )[0].configuration,
            s.config,
          );
          await tx`insert into beta_fantasy.scoring_rules(version,rules)values(${s.rules.version},${tx.json(s.rules)}) on conflict do nothing`;
          const scoring = (
            await tx`select id,rules from beta_fantasy.scoring_rules where version=${s.rules.version}`
          )[0];
          assert.deepEqual(scoring.rules, s.rules);
          for (const id of ids) {
            await tx`insert into sports_feed.sport_sandbox_access values(${id}) on conflict do nothing`;
            const cards = s.players.map(
              (
                p: {
                  id: string;
                  name: string;
                  position: string;
                  eligible_positions: string[];
                },
                i: number,
              ) => ({
                id: uuid(`${s.sport}-private-test-v1-${id}-${p.id}`),
                player_id: p.id,
                canonical_player_id: p.id,
                owner_id: id,
                name: p.name,
                team: `Fictional ${s.label} testing`,
                sport: s.sport,
                position: p.position,
                eligible_positions: p.eligible_positions,
                status: "active",
                listed: false,
                tier:
                  i < s.config.slots.length
                    ? "CORE"
                    : ["RARE", "ELITE", "ULTRA_RARE", "LEGENDARY", "ICON"][
                        i % 5
                      ],
                serial: 1,
                max_supply: 0,
                multiplierTenths: 10,
                season: "SYNTHETIC TEST",
                verifiedJerseyNumber: null,
              }),
            );
            await tx`insert into sports_feed.sport_sandbox_inventory(user_id,sport,cards)values(${id},${s.sport},${tx.json(cards)}) on conflict do nothing`;
          }
          for (const r of s.rounds)
            for (const competitionMode of ["OPEN", "SALARY_CAP"]) {
              const name = `${s.label} TEST ${competitionMode} ${r.scheduledAt.slice(0, 10)}`;
              if (
                (
                  await tx`select id from beta_fantasy.competitions where name=${name} and sport=${s.sport}`
                ).length
              )
                continue;
              assert(
                Date.parse(r.scheduledAt) > Date.now(),
                "Review elapsed testing schedule",
              );
              const id = randomUUID();
              const rules = {
                mode: competitionMode,
                lineup_version: s.config.version,
                inventory_scope: s.config.inventoryScope,
                lock_policy: "round-wide-v1",
                scoring_version: s.rules.version,
                synthetic: true,
                sport_beta_scope: "private-test-v1",
                authority,
              };
              await tx`insert into beta_fantasy.competitions(id,name,sport,season,round,locks_at,rules,scoring_id,prize) values(${id},${name},${s.sport},'PRIVATE-TEST-2026',${r.round},${r.scheduledAt},${tx.json(rules)},${scoring.id},'No cash prize')`;
              await tx`insert into sports_feed.sport_rounds(competition_id,sport,fixtures) values(${id},${s.sport},${tx.json([{ fixtureId: `sim:${s.sport}:${id}`, scheduledAt: r.scheduledAt, status: "scheduled", playerIds: s.players.map((p: { id: string }) => p.id) }])})`;
              created++;
            }
          await tx`update sports_feed.private_beta_sports set enabled=true,authority=${authority} where sport=${s.sport} and not enabled`;
        }
        assert.deepEqual(await snapshot(), before, "Existing records changed");
        await tx`insert into beta_private.audit_events(actor,action,subject,details)values('owner-authorised-private-beta','multisport_private_testing_prepared','afl,nrl',${tx.json({ planHash, created, testers: ids, permanentCards: 0, creditChanges: 0, realData: false })})`;
        receipt = {
          mode,
          planHash,
          created,
          accounts,
          existingRecordsUnchanged: true,
          permanentCards: 0,
          realData: false,
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
    await writeFile(
      evidence + `/fixture-${mode}.json`,
      JSON.stringify(receipt, null, 2),
    );
    console.log(JSON.stringify(receipt));
  } catch (e) {
    console.error({
      failed: true,
      code: (e as { code?: string }).code ?? "FAILED",
      message:
        e instanceof Error
          ? e.message.replace(/postgres(?:ql)?:\/\/\S+/g, "[redacted]")
          : "Failed",
    });
    process.exitCode = 1;
  } finally {
    await sql.end({ timeout: 3 });
  }
}

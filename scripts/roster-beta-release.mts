/** Exact private-beta target. Rehearsal rolls back every change; no member-session impersonation. */
import fs from "node:fs/promises";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import { ownerDatabase, projectRef } from "./owner-gameplay-db.mjs";
import {
  prepareRosterBetaCatalogue,
  rosterBetaCoreCards,
} from "../src/core/roster-beta-prepare";
import {
  validateCredits,
  type CreditsState,
} from "../src/core/credits-sandbox";
import type { EconomyPlayer } from "../src/core/card-economy";
const root = process.cwd();
const mode = process.argv[2];
assert(["inspect", "rehearse", "apply", "verify"].includes(mode));
const evidence = root + "/docs/qa/real-rosters/release";
await fs.mkdir(evidence, { recursive: true });
const dataset = JSON.parse(
  await fs.readFile(
    root + "/public/data/rosters/wikimedia-roster-beta-2026-10-23-v1.json",
    "utf8",
  ),
);
const players = dataset.players as EconomyPlayer[];
const migration = "20261022222531_verified_roster_beta_inventory.sql";
const body = await fs.readFile(
  root + "/supabase/migrations/" + migration,
  "utf8",
);
const hash = (v: unknown) =>
  createHash("sha256")
    .update(typeof v === "string" ? v : JSON.stringify(v))
    .digest("hex");
const planHash = hash({ dataset, migration: body });
process.chdir("C:/Users/61412/Documents/ChatGPT/Docked.com.au");
assert.equal(projectRef, "pojoymtniryarxxunyvz");
const privateDir = "private-data/real-roster-beta";
await fs.mkdir(privateDir, { recursive: true });
const sql = ownerDatabase();
const ids = [
  "623d1e69-d0f3-493f-9713-108e8c21469a",
  "ef641248-67be-4c32-9b12-9205bfcee15b",
  "9fa5cdbb-aa2e-4ebe-9f2c-de9885233cd3",
  "d6ab4838-7108-4c50-8ab8-c5947ab55bd8",
];
const protectedTables = [
  "beta_fantasy.cards",
  "beta_fantasy.players",
  "beta_fantasy.entries",
  "beta_fantasy.results",
  "beta_fantasy.ownership_events",
  "beta_fantasy.sales",
  "credits_sandbox.permanent_players",
  "credits_sandbox.card_definitions",
  "credits_sandbox.card_instances",
  "credits_sandbox.pack_receipts",
  "sports_feed.nfl_rounds",
  "sports_feed.nfl_control",
];
const authority =
  "Owner explicit real-player catalogue instruction: source-verified NBA/AFL/NRL rosters, isolated non-permanent beta inventory and test-credit packs. No permanent issuance or unlicensed statistics.";
try {
  if (mode === "inspect") {
    const snapshot = await sql.begin(
      "isolation level repeatable read read only",
      async (tx) => {
        const tables: Record<string, unknown> = {};
        for (const table of [
          ...protectedTables,
          "credits_sandbox.state",
          "credits_sandbox.nba_fixture_players",
          "credits_sandbox.pack_configuration",
          "sports_feed.sport_sandbox_inventory",
          "sports_feed.sport_rounds",
          "supabase_migrations.schema_migrations",
        ])
          tables[table] = await tx.unsafe(
            `select to_jsonb(t) row from ${table} t`,
          );
        const functions =
          await tx`select n.nspname,p.proname,pg_get_function_identity_arguments(p.oid) args,pg_get_functiondef(p.oid) definition from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('sports_feed','credits_sandbox','beta_private') and p.prokind='f'`;
        return { at: new Date().toISOString(), projectRef, tables, functions };
      },
    );
    const bytes = JSON.stringify(snapshot);
    const file = privateDir + `/recovery-${Date.now()}.private.json`;
    await fs.writeFile(file, bytes, { flag: "wx", mode: 0o600 });
    assert.equal(await fs.readFile(file, "utf8"), bytes);
    const receipt = {
      projectRef,
      planHash,
      sourceCounts: Object.fromEntries(
        ["basketball", "afl", "nrl"].map((s) => [
          s,
          players.filter((p) => p.sport === s).length,
        ]),
      ),
      snapshotHash: hash(bytes),
      snapshotBytes: Buffer.byteLength(bytes),
      readbackVerified: true,
      disasterRecoveryTested: false,
      migration,
      backupScope:
        "Application records and function definitions; no Auth secrets. Additive migration rollback retains new audit history and disables affected private sport gates.",
    };
    await fs.writeFile(
      evidence + "/inspect.json",
      JSON.stringify(receipt, null, 2),
    );
    console.log(receipt);
  } else if (mode === "verify") {
    const counts =
      await sql`select identity->>'sport' sport,count(*)::int players,count(distinct identity->>'currentTeam')::int teams from credits_sandbox.nba_fixture_players where identity->>'inventoryClass'='real-roster-beta-v1' group by 1 order by 1`;
    const inventories =
      await sql`select user_id,sport,count(*)::int real_core_cards from sports_feed.sport_sandbox_inventory,jsonb_array_elements(cards)c where c->>'inventory_source'='roster-beta-core-v1' group by 1,2 order by 1,2`;
    const accounts =
      await sql`select b.user_id,b.enabled,u.email_confirmed_at is not null confirmed,beta_private.beta_gameplay_identity(u.id) admitted,beta_private.gameplay_mfa_required(u.id) mfa_required from sports_feed.nba_beta_access b join auth.users u on u.id=b.user_id where b.user_id=any(${ids}::uuid[])`;
    const receipt = {
      projectRef,
      counts,
      inventories,
      accounts,
      authenticatedHosted: false,
      realStatistics: false,
      permanentIssuance: false,
    };
    await fs.writeFile(
      evidence + "/verify.json",
      JSON.stringify(receipt, null, 2),
    );
    console.log(receipt);
  } else {
    assert.equal(
      JSON.parse(await fs.readFile(evidence + "/inspect.json", "utf8"))
        .planHash,
      planHash,
    );
    if (mode === "apply") {
      const r = JSON.parse(
        await fs.readFile(evidence + "/rehearse.json", "utf8"),
      );
      assert(r.passed && r.planHash === planHash);
      const promoted = JSON.parse(
        await fs.readFile(evidence + "/deployment-promoted.json", "utf8"),
      );
      const live = await fetch("https://docked.com.au/api/beta-release", {
        cache: "no-store",
        signal: AbortSignal.timeout(30000),
      });
      assert(
        live.ok && (await live.json()).commit === promoted.commit,
        "Deploy the compatible reviewed application before importing roster products",
      );
    }
    let receipt: unknown;
    try {
      await sql.begin(async (tx) => {
        await tx`select pg_advisory_xact_lock(71022026)`;
        await tx`select pg_advisory_xact_lock(71820342)`;
        await tx`set local lock_timeout='10s'`;
        await tx`set local statement_timeout='180s'`;
        const snapshot = async () => {
          const a: Record<string, unknown> = {};
          for (const t of protectedTables)
            a[t] = (
              await tx.unsafe(
                `select count(*) n,md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by md5(to_jsonb(t)::text)),'')) hash from ${t} t`,
              )
            )[0];
          return a;
        };
        const before = await snapshot();
        const version = migration.split("_")[0];
        if (
          !(
            await tx`select version from supabase_migrations.schema_migrations where version=${version}`
          ).length
        ) {
          await tx.unsafe(body);
          await tx`insert into supabase_migrations.schema_migrations(version,name,statements)values(${version},'verified_roster_beta_inventory',${[body]})`;
        }
        const [row] =
          await tx`select document from credits_sandbox.state where id for update`;
        const original = row.document as CreditsState;
        validateCredits(original);
        assert(original.economy?.enabled);
        const prepared = prepareRosterBetaCatalogue(
          original.economy,
          players,
          Date.now(),
        );
        await tx`insert into credits_sandbox.nba_fixture_players(id,identity) select v->>'id',v from jsonb_array_elements(${tx.json(players)})v on conflict do nothing`;
        const registered =
          await tx`select id,identity from credits_sandbox.nba_fixture_players where id=any(${players.map((p) => p.id)})`;
        const identities = new Map(registered.map((r) => [r.id, r.identity]));
        for (const p of players) assert.deepEqual(identities.get(p.id), p);
        for (const p of prepared.products) {
          await tx`insert into credits_sandbox.pack_configuration(version,document)values(${p.version},${tx.json(p)}) on conflict do nothing`;
          assert.deepEqual(
            (
              await tx`select document from credits_sandbox.pack_configuration where version=${p.version}`
            )[0].document,
            p,
          );
        }
        const state = { ...original, economy: prepared.economy };
        const { economy: oldE, ...oldLedger } = original;
        const { economy: newE, ...newLedger } = state;
        assert.deepEqual(newLedger, oldLedger);
        for (const [id, p] of Object.entries(oldE!.players))
          assert.deepEqual(newE.players[id], p);
        for (const [id, p] of Object.entries(oldE!.products))
          assert.deepEqual(newE.products[id], p);
        for (const key of [
          "definitions",
          "instances",
          "packs",
          "retiredTestInstances",
        ] as const)
          assert.deepEqual(newE[key], oldE![key]);
        validateCredits(state);
        await tx`update credits_sandbox.state set document=${tx.json(state)},revision=revision+1 where id`;
        let added = 0;
        for (const id of ids) {
          assert(
            (
              await tx`select user_id from sports_feed.nba_beta_access where user_id=${id} and enabled and expires_at>clock_timestamp()`
            ).length === 1,
            "Existing authorised identity required",
          );
          for (const sport of ["basketball", "afl", "nrl"]) {
            const [inv] =
              await tx`select cards from sports_feed.sport_sandbox_inventory where user_id=${id} and sport=${sport} for update`;
            assert(inv, "Existing isolated inventory required");
            const current = inv.cards;
            const cards = rosterBetaCoreCards(
              id,
              players.filter((p) => p.sport === sport),
            );
            const newCards = cards.filter(
              (c) => !current.some((old: { id: string }) => old.id === c.id),
            );
            for (const c of cards) {
              const old = current.find((v: { id: string }) => v.id === c.id);
              if (old) assert.deepEqual(old, c);
            }
            await tx`update sports_feed.sport_sandbox_inventory set cards=${tx.json([...current, ...newCards])} where user_id=${id} and sport=${sport}`;
            added += newCards.length;
          }
        }
        let rounds = 0;
        for (const r of await tx`select c.id,c.sport,r.fixtures from beta_fantasy.competitions c join sports_feed.sport_rounds r on r.competition_id=c.id where c.sport in ('basketball','afl','nrl') and c.locks_at>clock_timestamp() and coalesce(c.rules->>'nba_beta_scope',c.rules->>'sport_beta_scope')='private-test-v1' for update of r`) {
          const fixtures = r.fixtures;
          assert(
            fixtures.length &&
              fixtures.every(
                (f: { fixtureId: string; status: string }) =>
                  f.fixtureId.startsWith("sim:") && f.status === "scheduled",
              ),
            "Only scheduled isolated fixtures may receive roster eligibility",
          );
          for (const f of fixtures)
            f.playerIds = [
              ...new Set([
                ...f.playerIds,
                ...players
                  .filter((p) => p.sport === r.sport)
                  .map((p) => p.fixturePlayerId),
              ]),
            ];
          await tx`update sports_feed.sport_rounds set fixtures=${tx.json(fixtures)} where competition_id=${r.id}`;
          rounds++;
        }
        assert(rounds > 0, "Upcoming private test rounds required");
        assert.deepEqual(
          await snapshot(),
          before,
          "Protected NFL/ownership/history records changed",
        );
        await tx`insert into beta_private.audit_events(actor,action,subject,details)values('owner-authorised-private-beta','real_roster_beta_catalogue','basketball,afl,nrl',${tx.json({ authority, planHash, players: players.length, freeCoreCardsAdded: added, rounds, permanentIssuance: 0, creditChanges: 0, ledgerHash: hash(oldLedger) })})`;
        receipt = {
          projectRef,
          passed: true,
          mode,
          planHash,
          migration,
          players: players.length,
          freeCoreCardsAdded: added,
          rounds,
          permanentRecordsUnchanged: true,
          ledgerUnchanged: true,
          creditChanges: 0,
          permanentIssuance: 0,
          before,
          authenticatedHosted: false,
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
      evidence + "/" + mode + ".json",
      JSON.stringify(receipt, null, 2),
    );
    console.log({ mode, passed: true, planHash });
  }
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

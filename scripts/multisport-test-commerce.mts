// Operator preparation of isolated test products only. Never issues cards or credits.
import assert from "node:assert/strict";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { ownerDatabase, projectRef } from "./owner-gameplay-db.mjs";
import {
  prepareSportTestProducts,
  type EconomyPlayer,
} from "../src/core/card-economy";
import { fixtureSports, type FixtureSport } from "../src/core/fixture-sports";
import { assertMemberTestEconomy } from "../src/core/member-test-wallet";
import {
  validateCredits,
  type CreditsState,
} from "../src/core/credits-sandbox";

const root = process.cwd();
process.chdir("C:/Users/61412/Documents/ChatGPT/Docked.com.au");
assert.equal(projectRef, "pojoymtniryarxxunyvz");
const mode = process.argv[2];
assert(["prepare", "rehearse", "apply"].includes(mode));
const evidence = root + "/docs/qa/overnight-multisport/release";
await mkdir(evidence, { recursive: true });
const authority =
  "Owner overnight instruction: isolated NBA/AFL/NRL packs and trading with existing nonwithdrawable beta credits; no permanent issuance, real players, real money or public access.";
const hash = (value: unknown) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");
const sql = ownerDatabase();
try {
  if (mode === "prepare") {
    const [row] =
      await sql`select document from credits_sandbox.state where id`;
    const state = row.document as CreditsState;
    assertMemberTestEconomy(state);
    const economy = structuredClone(state.economy!);
    assert(economy);
    const now = Date.now();
    const plan = {
      authority,
      createdAt: new Date(now).toISOString(),
      sports: [] as {
        sport: FixtureSport;
        players: EconomyPlayer[];
        products: ReturnType<typeof prepareSportTestProducts>;
      }[],
    };
    for (const sport of Object.keys(fixtureSports) as FixtureSport[]) {
      const inventories =
        await sql`select cards from sports_feed.sport_sandbox_inventory where sport=${sport} and user_id in(select user_id from sports_feed.nba_beta_access where enabled and expires_at>clock_timestamp())`;
      assert(
        inventories.length > 0,
        "Existing private fixture inventory required",
      );
      const players = new Map<string, EconomyPlayer>();
      for (const inventory of inventories)
        for (const card of inventory.cards) {
          if (card.inventory_source === "credits-fixture-v1") continue;
          assert(
            card.sport === sport &&
              /^(Test|QA) /.test(card.name) &&
              card.max_supply === 0,
            "Only explicitly fictional free test inventory may seed this plan",
          );
          assert(
            (fixtureSports[sport].positions as readonly string[]).includes(
              card.position,
            ),
          );
          const id = `${fixtureSports[sport].prefix}-fixture-${card.player_id}`;
          const identity: EconomyPlayer = {
            id,
            provider: "fixture",
            providerId: id,
            fixturePlayerId: card.player_id,
            synthetic: true,
            sport,
            assetKind: "player",
            name: card.name,
            position: card.position,
            eligiblePositions: card.eligible_positions,
            currentTeam: card.team,
            status: "active",
            observedAt: now,
            sourceRevision: "private-test-v1",
            presentation: `docked-${sport}-v1`,
            verifiedJerseyNumber: null,
          };
          if (players.has(id))
            assert.deepEqual(
              players.get(id),
              identity,
              "Conflicting existing fictional identities",
            );
          players.set(id, identity);
        }
      assert(players.size >= 9);
      plan.sports.push({
        sport,
        players: [...players.values()].sort((a, b) => a.id.localeCompare(b.id)),
        products: prepareSportTestProducts(economy, sport, now),
      });
    }
    await writeFile(
      evidence + "/commerce-plan.json",
      JSON.stringify(plan, null, 2),
      { flag: "wx" },
    );
    console.log(
      JSON.stringify({
        prepared: true,
        sports: plan.sports.map((s) => ({
          sport: s.sport,
          fictionalPlayers: s.players.length,
          products: s.products.map((p) => ({
            name: p.name,
            price: p.priceCredits,
            cards: p.cards,
          })),
        })),
        permanentIssuance: 0,
        creditChanges: 0,
      }),
    );
  } else {
    const plan = JSON.parse(
      await readFile(evidence + "/commerce-plan.json", "utf8"),
    );
    assert.equal(plan.authority, authority);
    const planHash = hash(plan);
    if (mode === "apply") {
      const review = JSON.parse(
        await readFile(evidence + "/commerce-rehearse.json", "utf8"),
      );
      assert.equal(review.planHash, planHash);
      assert.equal(review.passed, true);
    }
    let receipt: unknown;
    try {
      await sql.begin(async (tx) => {
        await tx`select pg_advisory_xact_lock(71022026)`;
        await tx`select pg_advisory_xact_lock(71820342)`;
        await tx`set local lock_timeout='10s'`;
        assert.equal(
          (
            await tx`select version from supabase_migrations.schema_migrations where version='20261022203038'`
          ).length,
          1,
        );
        const [row] =
          await tx`select document,revision from credits_sandbox.state where id for update`;
        const original = row.document as CreditsState;
        assertMemberTestEconomy(original);
        validateCredits(original);
        const state = structuredClone(original),
          e = state.economy!;
        assert(e && e.enabled);
        const protectedTables = [
          "beta_fantasy.cards",
          "beta_fantasy.players",
          "beta_fantasy.entries",
          "beta_fantasy.results",
          "beta_fantasy.sales",
          "credits_sandbox.card_instances",
          "credits_sandbox.card_definitions",
          "credits_sandbox.permanent_players",
          "credits_sandbox.pack_receipts",
          "sports_feed.nfl_rounds",
          "sports_feed.nfl_control",
        ];
        const snapshot = async () => {
          const out: Record<string, unknown> = {};
          for (const table of protectedTables)
            out[table] = (
              await tx.unsafe(
                `select count(*) n,md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by md5(to_jsonb(t)::text)),'')) hash from ${table} t`,
              )
            )[0];
          return out;
        };
        const before = await snapshot();
        for (const s of plan.sports) {
          assert(Object.hasOwn(fixtureSports, s.sport));
          for (const p of s.players) {
            assert(
              p.synthetic === true &&
                p.provider === "fixture" &&
                p.sport === s.sport,
            );
            await tx`insert into credits_sandbox.nba_fixture_players(id,identity) values(${p.id},${tx.json(p)}) on conflict do nothing`;
            assert.deepEqual(
              (
                await tx`select identity from credits_sandbox.nba_fixture_players where id=${p.id}`
              )[0].identity,
              p,
            );
            if (e.players[p.id]) assert.deepEqual(e.players[p.id], p);
            e.players[p.id] = p;
          }
          for (const p of s.products) {
            await tx`insert into credits_sandbox.pack_configuration(version,document) values(${p.version},${tx.json(p)}) on conflict do nothing`;
            assert.deepEqual(
              (
                await tx`select document from credits_sandbox.pack_configuration where version=${p.version}`
              )[0].document,
              p,
            );
            if (e.products[p.id]) assert.deepEqual(e.products[p.id], p);
            e.products[p.id] = p;
            e.activeProductVersions ??= Object.keys(original.economy!.products);
            if (!e.activeProductVersions.includes(p.id))
              e.activeProductVersions.push(p.id);
          }
          if (s.sport === "basketball")
            e.nbaTestAllocation = {
              enabled: true,
              scope: "isolated-fixtures-v1",
            };
          else {
            e.fixtureTestAllocation ??= {};
            e.fixtureTestAllocation[s.sport as "afl" | "nrl"] = {
              enabled: true,
              scope: "isolated-fixtures-v1",
            };
          }
        }
        // Only catalogue/configuration additions are allowed; all financial and ownership documents stay byte-for-byte equivalent.
        const { economy: oldEconomy, ...oldLedger } = original;
        const { economy: newEconomy, ...newLedger } = state;
        assert.deepEqual(newLedger, oldLedger);
        for (const [key, value] of Object.entries(oldEconomy!)) {
          if (
            [
              "players",
              "products",
              "activeProductVersions",
              "nbaTestAllocation",
              "fixtureTestAllocation",
            ].includes(key)
          )
            continue;
          assert.deepEqual(
            (newEconomy as unknown as Record<string, unknown>)[key],
            value,
          );
        }
        for (const [id, p] of Object.entries(oldEconomy!.players))
          assert.deepEqual(e.players[id], p);
        for (const [id, p] of Object.entries(oldEconomy!.products))
          assert.deepEqual(e.products[id], p);
        validateCredits(state);
        assertMemberTestEconomy(state);
        await tx`update credits_sandbox.state set document=${tx.json(state)},revision=revision+1 where id`;
        assert.deepEqual(await snapshot(), before);
        await tx`insert into beta_private.audit_events(actor,action,subject,details)values('owner-authorised-private-beta','isolated_multisport_test_commerce','basketball,afl,nrl',${tx.json({ planHash, authority, permanentIssuance: 0, creditChanges: 0, ledgerHash: hash(oldLedger), appFlagStillRequired: true })})`;
        receipt = {
          mode,
          passed: true,
          planHash,
          priorRevision: row.revision,
          ledgerUnchanged: true,
          permanentRecordsUnchanged: true,
          permanentIssuance: 0,
          creditChanges: 0,
          appFlagStillRequired: true,
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
      evidence + `/commerce-${mode}.json`,
      JSON.stringify(receipt, null, 2),
    );
    console.log(JSON.stringify(receipt));
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

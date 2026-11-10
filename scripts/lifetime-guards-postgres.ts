/** Loopback PostgreSQL only, artificial player identities and no provider calls. */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import postgres from "postgres";
import { rarityRule, limitedRarities } from "../src/core/card-rarity";
import {
  commercialPack,
  commercialPolicyVersion,
} from "../src/core/commercial-billing";
const url = new URL(process.env.COMMERCIAL_ACCEPTANCE_DB ?? "");
assert.equal(url.hostname, "127.0.0.1");
assert.equal(url.pathname, "/commercial_acceptance");
const sql = postgres(url.href, { max: 24, onnotice: () => {} });
const migration = readFileSync(
  "supabase/migrations/20261109231834_commercial_lifetime_supply_guards.sql",
  "utf8",
);
const checks: string[] = [];
async function check(name: string, f: () => Promise<void>) {
  await f();
  checks.push(name);
  console.log("PASS " + name);
}
const member = randomUUID(),
  other = randomUUID();
async function definition(
  rarity: (typeof limitedRarities)[number],
  issued = 0,
) {
  const player = randomUUID();
  const [d] =
    await sql`insert into commercial_billing.definitions(player_id,sport,rarity,lifetime_cap,issued,legacy_issued,approved,rights_reference,snapshot)values(${player},'nfl',${rarity},${rarityRule(rarity).lifetimeCap!},${issued},${issued},true,'isolated guard fixture',${sql.json({ provider: "isolated", providerId: player, synthetic: true })}) returning *`;
  return d as {
    id: string;
    player_id: string;
    rarity: typeof rarity;
    issued: number;
    snapshot: Record<string, unknown>;
  };
}
async function mint(
  d: { id: string; rarity: string; issued: number },
  overrides: { serial?: number; slot?: number } = {},
) {
  return sql.begin(async (tx) => {
    const pack = randomUUID(),
      card = randomUUID(),
      p = commercialPack("nfl", "STANDARD", 1);
    await tx`insert into commercial_billing.packs(id,member_id,request,product,price,funding,draw_evidence,policy_version)values(${pack},${member},${randomUUID()},${tx.json(p)},${p.priceCredits},'[]',${tx.json([{ rarity: d.rarity }])},${commercialPolicyVersion})`;
    await tx`insert into commercial_billing.cards(id,definition,serial,owner_id,pack,slot)values(${card},${d.id},${overrides.serial ?? Number(d.issued) + 1},${member},${pack},${overrides.slot ?? 0})`;
    return { pack, card };
  });
}
async function main() {
  try {
    await sql.unsafe(
      "create role anon;create role authenticated;create role service_role;create schema credits_sandbox;create table credits_sandbox.state(document jsonb not null);create table credits_sandbox.card_instances(id uuid,document jsonb);create table credits_sandbox.nba_fixture_instances(id uuid,document jsonb);create schema sports_feed;create table sports_feed.sport_sandbox_inventory(sport text,cards jsonb)",
    );
    await sql.unsafe(
      readFileSync(
        "supabase/migrations/20261101120754_commercial_google_ledger.sql",
        "utf8",
      ),
    );
    await sql.unsafe(migration);
    await sql.unsafe(migration);
    const approvals = Object.fromEntries(
      [
        "owner",
        "legal",
        "googlePlay",
        "privacy",
        "retention",
        "refundRecovery",
        "playerRights",
        "supplyReconciliation",
      ].map((k) => [k, "ISOLATED FIXTURE ONLY"]),
    );
    Object.assign(approvals, {
      validUntil: "2099-01-01T00:00:00Z",
      withdrawals: false,
      prizes: false,
      paidEntry: false,
      nba: false,
    });
    await sql`update commercial_billing.control set environment='acceptance',policy_version=${commercialPolicyVersion},approvals=${sql.json(approvals)}`;
    await sql`insert into commercial_billing.accounts values(${member}),(${other})`;
    await check(
      "exact approved caps and Core remains outside limited issuance",
      async () => {
        assert.equal(rarityRule("CORE").lifetimeCap, null);
        for (const rarity of limitedRarities)
          await assert.rejects(
            sql`insert into commercial_billing.definitions(player_id,sport,rarity,lifetime_cap,rights_reference,snapshot)values(${randomUUID()},'nfl',${rarity},${rarityRule(rarity).lifetimeCap! + 1},'isolated','{}')`,
            /approved_lifetime_cap/,
          );
      },
    );
    await check("database mint path respects disabled issuance", async () => {
      await assert.rejects(mint(await definition("ICON")), /disabled/);
    });
    await sql`update commercial_billing.control set issuance_enabled=true`;
    await check(
      "16 concurrent requests cannot mint a second lifetime Icon",
      async () => {
        const d = await definition("ICON");
        const results = await Promise.allSettled(
          Array.from({ length: 16 }, () => mint(d)),
        );
        assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
        assert.equal(
          (
            await sql`select issued from commercial_billing.definitions where id=${d.id}`
          )[0].issued,
          1,
        );
        const c = (
          await sql`select id from commercial_billing.cards where definition=${d.id}`
        )[0];
        await sql`update commercial_billing.cards set owner_id=${other},locked=true where id=${c.id}`;
        await assert.rejects(mint(d), /Supply exhausted/);
      },
    );
    await check(
      "all five terminal serials succeed once and stay sold out",
      async () => {
        for (const rarity of limitedRarities) {
          const d = await definition(
            rarity,
            rarityRule(rarity).lifetimeCap! - 1,
          );
          await mint(d);
          await assert.rejects(mint(d), /Supply exhausted/);
        }
      },
    );
    await check(
      "counter reset, counter-only increment, deletion and truncation denied",
      async () => {
        const d = await definition("RARE");
        await mint(d);
        await assert.rejects(
          sql`update commercial_billing.definitions set issued=0 where id=${d.id}`,
          /immutable/,
        );
        await assert.rejects(
          sql`update commercial_billing.definitions set issued=issued+1 where id=${d.id}`,
          /counter/,
        );
        for (const table of ["cards", "definitions", "packs"]) {
          await assert.rejects(
            sql.unsafe(`delete from commercial_billing.${table}`),
            /Immutable/,
          );
          await assert.rejects(
            sql.unsafe(`truncate commercial_billing.${table} cascade`),
            /Immutable/,
          );
        }
      },
    );
    await check(
      "wrong slot, wrong draw and partial pack roll back atomically",
      async () => {
        const d = await definition("RARE");
        await assert.rejects(mint(d, { slot: 1 }), /purchased pack/);
        await assert.rejects(mint({ ...d, rarity: "ICON" }), /purchased pack/);
        await assert.rejects(
          sql`insert into commercial_billing.packs(member_id,request,product,price,funding,draw_evidence,policy_version)values(${member},${randomUUID()},'{"cards":9}',1900,'[]','[]','isolated')`,
          /atomically/,
        );
        assert.equal(
          (
            await sql`select issued from commercial_billing.definitions where id=${d.id}`
          )[0].issued,
          0,
        );
      },
    );
    await check(
      "new alias/season cannot reset the same provider lifetime",
      async () => {
        const d = await definition("ICON");
        await assert.rejects(
          sql`insert into commercial_billing.definitions(player_id,sport,rarity,lifetime_cap,rights_reference,snapshot)values(${randomUUID()},'nfl','ICON',1,'new season',${sql.json({ ...d.snapshot, season: "2100" })})`,
          /commercial_provider_lifetime_identity/,
        );
      },
    );
    await check(
      "parallel TEST mint is blocked after lifetime binding; ownership updates allowed",
      async () => {
        const d = await definition("RARE"),
          id = randomUUID();
        const state = {
          economy: {
            players: {
              [d.player_id]: {
                sport: "nfl",
                provider: "isolated",
                providerId: d.player_id,
              },
            },
            instances: {},
          },
        };
        await sql`insert into credits_sandbox.state values(${sql.json(state)})`;
        await assert.rejects(
          sql`update credits_sandbox.state set document=jsonb_set(document,'{economy,instances}',${sql.json({ [id]: { playerId: d.player_id, rarity: "RARE" } })})`,
          /parallel issuance/,
        );
        for (const table of ["card_instances", "nba_fixture_instances"])
          await assert.rejects(
            sql.unsafe(
              `insert into credits_sandbox.${table}(id,document)values($1,$2)`,
              [id, { playerId: d.player_id, rarity: "RARE" } as never],
            ),
            /unrecorded inventory/,
          );
        await assert.rejects(
          sql`insert into sports_feed.sport_sandbox_inventory values('nfl',${sql.json([{ id, player_id: d.player_id, rarity: "RARE" }])})`,
          /unrecorded inventory/,
        );
        await sql`update credits_sandbox.state set document=document||'{"unrelated":"preserved"}'::jsonb`;
      },
    );
    await check(
      "runtime cannot import definitions or rewrite approval controls",
      async () => {
        await assert.rejects(
          sql.begin(async (tx) => {
            await tx.unsafe("set local role docked_commercial_app");
            await tx`update commercial_billing.control set issuance_enabled=true`;
          }),
          /permission denied/,
        );
      },
    );
    await sql.unsafe(migration);
    writeFileSync(
      "docs/qa/v31-p1-p4-20261110/lifetime-postgres.json",
      JSON.stringify(
        {
          at: new Date().toISOString(),
          database: "disposable PostgreSQL 17",
          simulatedPayments: true,
          checks,
          passed: true,
        },
        null,
        2,
      ) + "\n",
    );
  } finally {
    await sql.end({ timeout: 2 });
  }
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});

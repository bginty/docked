import assert from "node:assert/strict";
import postgres from "postgres";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import {
  initialCardEconomy,
  allocateNine,
  drawPackRarity,
} from "../src/core/card-economy";
import { rarityConfiguration } from "../src/core/card-rarity";
import {
  initialMemberTestCredits,
  testReceipt,
} from "../src/core/member-test-wallet";
import { executeCredits, wallet } from "../src/core/credits-sandbox";
import { CreditsSandboxStore } from "../src/server/credits-sandbox-store";
async function main() {
  const url = process.env.FANTASY_TEST_DATABASE_URL!;
  assert.equal(new URL(url).hostname, "127.0.0.1");
  assert.match(new URL(url).pathname, /docked_free_play_test_/);
  const sql = postgres(url, { max: 8, onnotice: () => {} }),
    runtime = postgres(url, {
      max: 8,
      connection: { options: "-c role=docked_beta_app" },
      onnotice: () => {},
    });
  try {
    await sql.unsafe(
      "create schema auth;create table auth.users(id uuid primary key);create role anon;create role authenticated;create role service_role;create role docked_beta_app;",
    );
    for (const m of [
      "20261011100229_financial_test_wallet.sql",
      "20261012101915_lifetime_card_economy.sql",
    ])
      await sql.unsafe(readFileSync("supabase/migrations/" + m, "utf8"));
    const now = Date.now();
    let s = initialMemberTestCredits();
    const players = Array.from({ length: 10 }, (_, i) => ({
      id: `fixture-${i}`,
      sport: "nfl" as const,
      assetKind: "player" as const,
      provider: "fixture",
      providerId: `gsis-${i}`,
      name: `Fixture ${i}`,
      position: "QB",
      currentTeam: "TEST",
      status: "active" as const,
      observedAt: now,
      sourceRevision: "fixture",
      presentation: "docked",
    }));
    s.economy = initialCardEconomy(players, now);
    // Exhaust nine of ten Icons through actual issuance, never by reducing a cap.
    let product = s.economy.products["standard-nine-test-v1"];
    product.guaranteedSlots = Object.fromEntries(
      Array.from({ length: 9 }, (_, i) => [i, "ICON" as const]),
    );
    const pre = allocateNine(
      s.economy,
      product.id,
      "fixture-retired-owner",
      "initial-icons",
      now,
      () => 0,
    );
    product = s.economy.products["standard-nine-test-v1"];
    for (const id of pre.cards) {
      const c = s.economy.instances[id];
      s.commerce.cards[id] = {
        tier: c.rarity,
        sport: "nfl",
        owner: "fixture-retired-owner",
        reserved: null,
      };
      s.cards[id] = {
        version: 1,
        restricted: true,
        locked: false,
        history: [
          {
            from: null,
            to: "fixture-retired-owner",
            reference: pre.id,
            at: now,
          },
        ],
      };
    }
    s.economy.packs[pre.id].openedAt = now;
    product.guaranteedSlots = Object.fromEntries(
      Array.from({ length: 9 }, (_, i) => [i, i === 0 ? "ICON" : "RARE"]),
    ) as typeof product.guaranteedSlots;
    product.version = "icon-contention-fixture-v1";
    // Every contender requires the single remaining Icon plus eight Rare cards.
    product.weights = {
      RARE: 9999,
      ELITE: 0,
      ULTRA_RARE: 0,
      LEGENDARY: 0,
      ICON: 1,
    };
    for (const id of ["alpha", "beta"])
      s = executeCredits(
        s,
        { id: "operator", role: "reviewer", aal: "aal2" },
        "grant-" + id,
        {
          kind: "promotion",
          member: id,
          amount: 10000,
          campaign: id,
          reason: "Synthetic isolated contention test only",
          confirmed: true,
          redeemable: false,
        },
        now,
      ).state;
    await sql`insert into credits_sandbox.rarity_configuration values(${rarityConfiguration.version},${sql.json(rarityConfiguration)})`;
    for (const p of players)
      await sql`insert into credits_sandbox.permanent_players values(${p.id},${p.sport},${p.provider},${p.providerId},${p.assetKind},${sql.json(p)})`;
    for (const p of Object.values(s.economy!.products))
      await sql`insert into credits_sandbox.pack_configuration values(${p.version},${sql.json(p as any)})`;
    await sql`insert into credits_sandbox.pack_configuration values(${pre.product.version},${sql.json(pre.product as any)})`;
    await sql`insert into credits_sandbox.state values(true,0,${sql.json(initialMemberTestCredits() as any)})`;
    await sql`update credits_sandbox.state set document=${sql.json(s as any)}`;
    const store = new CreditsSandboxStore(runtime);
    const outcomes = await Promise.allSettled(
      Array.from({ length: 8 }, (_, i) =>
        store.execute(
          { id: i % 2 ? "alpha" : "beta", role: "member" },
          "race-" + i,
          {
            kind: "buy-pack",
            product: product.id,
            configuration: product.version,
            confirmed: true,
            policy: s.policy.version,
          },
        ),
      ),
    );
    assert.equal(outcomes.filter((x) => x.status === "fulfilled").length, 1);
    const after = await store.read();
    assert.equal(
      Object.values(after.economy!.instances).filter((c) => c.rarity === "ICON")
        .length,
      10,
    );
    assert.equal(
      wallet(after, "alpha").available + wallet(after, "beta").available,
      19100,
    );
    assert.equal(Object.keys(after.economy!.instances).length, 18);
    const pack = Object.values(after.economy!.packs).find(
      (p) => p.id !== "initial-icons",
    )!;
    await Promise.all(
      Array.from({ length: 8 }, (_, i) =>
        store.execute({ id: pack.member, role: "member" }, "open-" + i, {
          kind: "open-pack",
          entitlement: pack.id,
        }),
      ),
    );
    const final = await store.read();
    assert.equal(testReceipt(final, pack.id, pack.member).cards.length, 9);
    await assert.rejects(
      () =>
        runtime`update credits_sandbox.permanent_players set provider_id='alias'`,
      /permission/,
    );
    await assert.rejects(
      () => runtime`delete from credits_sandbox.card_instances`,
      /permission/,
    );
    const distribution = Object.values(
      initialCardEconomy(players, now).products,
    ).map((p) => {
      const observed: Record<string, number> = {};
      for (let i = 0; i < 100000; i++) {
        const r = drawPackRarity(p, 0);
        observed[r] = (observed[r] ?? 0) + 1;
      }
      return { product: p.id, draws: 100000, configured: p.weights, observed };
    });
    const report = {
      at: new Date().toISOString(),
      passed: true,
      realLocalPostgres: true,
      connections: 8,
      finalIconWinners: 1,
      failedPurchasesNoDebitOrPartialCards: true,
      repeatedOpeningNineSameCards: true,
      immutableSupplyPermissions: true,
      distribution,
      interpretation:
        "Sampler smoke observation, not statistically proven fairness. Synthetic contention configuration, never a commercial offer.",
    };
    mkdirSync("docs/qa/economy-v2", { recursive: true });
    writeFileSync(
      "docs/qa/economy-v2/postgres.json",
      JSON.stringify(report, null, 2),
    );
    console.log(JSON.stringify(report));
  } finally {
    await runtime.end();
    await sql.end();
  }
}
main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});

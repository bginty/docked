import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { initialCardEconomy } from "../../src/core/card-economy";
import { initialMemberTestCredits } from "../../src/core/member-test-wallet";
import { executeCredits } from "../../src/core/credits-sandbox";
import { rarityConfiguration } from "../../src/core/card-rarity";
test("database enforces permanent supply, serial immutability, nine-card receipts and private access", async () => {
  const db = new PGlite();
  try {
    await db.exec(
      "create schema auth;create table auth.users(id uuid primary key);create role anon;create role authenticated;create role service_role;create role docked_beta_app;",
    );
    for (const file of [
      "20261011100229_financial_test_wallet.sql",
      "20261012101915_lifetime_card_economy.sql",
    ])
      await db.exec(readFileSync("supabase/migrations/" + file, "utf8"));
    let s = initialMemberTestCredits();
    const now = Date.now();
    const players = Array.from({ length: 12 }, (_, i) => ({
      id: `player-${i}`,
      sport: "nfl" as const,
      assetKind: "player" as const,
      provider: "synthetic",
      providerId: `gsis-${i}`,
      name: `Test ${i}`,
      position: "QB",
      currentTeam: "TEST",
      status: "active" as const,
      observedAt: now,
      sourceRevision: "fixture",
      presentation: "docked",
    }));
    s.economy = initialCardEconomy(players, now);
    await db.query(
      "insert into credits_sandbox.rarity_configuration values($1,$2)",
      [rarityConfiguration.version, rarityConfiguration],
    );
    for (const p of players)
      await db.query(
        "insert into credits_sandbox.permanent_players values($1,$2,$3,$4,$5,$6)",
        [p.id, p.sport, p.provider, p.providerId, p.assetKind, p],
      );
    for (const p of Object.values(s.economy.products))
      await db.query(
        "insert into credits_sandbox.pack_configuration values($1,$2)",
        [p.version, p],
      );
    await db.query("insert into credits_sandbox.state values(true,0,$1)", [
      initialMemberTestCredits(),
    ]);
    await db.query("update credits_sandbox.state set document=$1", [s]);
    s = executeCredits(
      s,
      { id: "owner", role: "reviewer", aal: "aal2" },
      "grant",
      {
        kind: "promotion",
        member: "member",
        amount: 900,
        campaign: "test",
        reason: "Isolated database economy fixture",
        confirmed: true,
        redeemable: false,
      },
      now,
    ).state;
    s = executeCredits(
      s,
      { id: "member", role: "member" },
      "pack",
      {
        kind: "buy-pack",
        product: "standard-nine-test-v1",
        configuration: "standard-nine-test-v1",
        policy: s.policy.version,
        confirmed: true,
      },
      now,
    ).state;
    await db.exec("set role docked_beta_app");
    await db.query("update credits_sandbox.state set document=$1", [s]);
    const count = await db.query<{ n: number }>(
      "select count(*)::int n from credits_sandbox.card_instances",
    );
    assert.equal(count.rows[0].n, 9);
    const id = Object.keys(s.economy!.instances)[0];
    const bad = structuredClone(s);
    bad.economy!.instances[id].serial++;
    await assert.rejects(
      () => db.query("update credits_sandbox.state set document=$1", [bad]),
      /immutable/,
    );
    const reroll = structuredClone(s);
    reroll.economy!.packs.pack.cards.reverse();
    await assert.rejects(
      () => db.query("update credits_sandbox.state set document=$1", [reroll]),
      /rerolled/,
    );
    const removed = structuredClone(s);
    delete removed.economy;
    await assert.rejects(
      () => db.query("update credits_sandbox.state set document=$1", [removed]),
      /removed/,
    );
    await assert.rejects(
      () => db.exec("update credits_sandbox.card_instances set serial=1"),
      /permission/,
    );
    await assert.rejects(
      () =>
        db.exec(
          "update credits_sandbox.rarity_configuration set document='{}'",
        ),
      /permission/,
    );
    await db.exec("reset role;set role authenticated");
    await assert.rejects(
      () => db.exec("select * from credits_sandbox.state"),
      /permission/,
    );
    await db.exec("reset role");
    const icon = {
      ...s.economy!.instances[id],
      id: "00000000-0000-4000-8000-000000000001",
      definition: "player-0:ICON",
      playerId: "player-0",
      rarity: "ICON",
      serial: 1,
      lifetimeCap: 1,
    };
    await db.query(
      "insert into credits_sandbox.card_definitions values($1,$2,$3,$4,$5)",
      [
        icon.definition,
        icon.playerId,
        icon.rarity,
        rarityConfiguration.version,
        1,
      ],
    );
    await db.query(
      "insert into credits_sandbox.card_instances values($1,$2,$3,$4)",
      [icon.id, icon.definition, 1, icon],
    );
    await assert.rejects(
      () =>
        db.query(
          "insert into credits_sandbox.card_instances values($1,$2,$3,$4)",
          [
            "00000000-0000-4000-8000-000000000002",
            icon.definition,
            2,
            { ...icon, serial: 2 },
          ],
        ),
      /cap violation/,
    );
    await assert.rejects(
      () => db.exec("delete from credits_sandbox.card_instances"),
      /immutable/,
    );
  } finally {
    await db.close();
  }
});

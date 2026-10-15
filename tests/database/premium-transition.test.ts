import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import {
  marketplaceFixture,
  marketActors,
} from "../fixtures/marketplace-state";
import { rarityConfiguration } from "../../src/core/card-rarity";
import { executeCredits } from "../../src/core/credits-sandbox";
import { premiumUltraVersion } from "../../src/core/card-economy";
import { applyPremiumPackTransition } from "../../src/server/premium-pack-transition";
test("registered Premium transition is atomic and idempotent; database retains sealed receipts and rejects altered configuration", async () => {
  const db = new PGlite();
  try {
    await db.exec(
      "create schema auth;create table auth.users(id uuid primary key);create role anon;create role authenticated;create role service_role;create role docked_beta_app;",
    );
    for (const f of [
      "20261011100229_financial_test_wallet.sql",
      "20261012101915_lifetime_card_economy.sql",
    ])
      await db.exec(readFileSync(`supabase/migrations/${f}`, "utf8"));
    let s = marketplaceFixture();
    s = executeCredits(
      s,
      marketActors[0],
      "old-sealed",
      {
        kind: "buy-pack",
        product: "premium-nine-seven-test-v2",
        configuration: "premium-nine-seven-test-v2",
        confirmed: true,
        policy: s.policy.version,
      },
      Date.now(),
    ).state;
    await db.query(
      "insert into credits_sandbox.rarity_configuration values($1,$2)",
      [rarityConfiguration.version, rarityConfiguration],
    );
    for (const p of Object.values(s.economy!.players))
      await db.query(
        "insert into credits_sandbox.permanent_players values($1,$2,$3,$4,$5,$6)",
        [p.id, p.sport, p.provider, p.providerId, p.assetKind, p],
      );
    for (const p of Object.values(s.economy!.products))
      await db.query(
        "insert into credits_sandbox.pack_configuration values($1,$2)",
        [p.version, p],
      );
    await db.query("insert into credits_sandbox.state values(true,0,$1)", [s]);
    const query = async (sql: string, values?: unknown[]) =>
      db.query<Record<string, any>>(sql, values);
    await db.exec("begin");
    const first = await applyPremiumPackTransition(query);
    assert.equal(first.changed, true);
    await db.exec("rollback");
    assert.equal(
      (
        await db.query(
          "select * from credits_sandbox.pack_configuration where version=$1",
          [premiumUltraVersion],
        )
      ).rows.length,
      0,
    );
    assert.deepEqual(
      (
        await db.query<{ document: typeof s }>(
          "select document from credits_sandbox.state",
        )
      ).rows[0].document,
      s,
    );
    await db.exec("begin");
    await applyPremiumPackTransition(query);
    await db.exec("commit");
    await db.exec("begin");
    assert.equal((await applyPremiumPackTransition(query)).changed, false);
    await db.exec("commit");
    const upgraded = (
      await db.query<{ document: typeof s }>(
        "select document from credits_sandbox.state",
      )
    ).rows[0].document;
    assert.deepEqual(upgraded.economy!.packs, s.economy!.packs);
    assert.deepEqual(
      upgraded.economy!.products["standard-nine-seven-test-v2"],
      s.economy!.products["standard-nine-seven-test-v2"],
    );
    assert.equal(
      (await db.query("select * from credits_sandbox.history")).rows.length,
      1,
    );
    await db.exec("set role docked_beta_app");
    const bought = executeCredits(
      upgraded,
      marketActors[0],
      "new-premium",
      {
        kind: "buy-pack",
        product: premiumUltraVersion,
        configuration: premiumUltraVersion,
        policy: s.policy.version,
        confirmed: true,
      },
      Date.now(),
    ).state;
    await db.query("update credits_sandbox.state set document=$1", [bought]);
    const bad = structuredClone(bought);
    bad.economy!.products[premiumUltraVersion].weights.RARE = 1;
    await assert.rejects(
      () => db.query("update credits_sandbox.state set document=$1", [bad]),
      /Unregistered nine-card product/,
    );
    await assert.rejects(
      () =>
        db.query(
          "update credits_sandbox.pack_configuration set document='{}' where version=$1",
          [premiumUltraVersion],
        ),
      /permission/,
    );
    const opened = executeCredits(
      bought,
      marketActors[0],
      "open-old",
      { kind: "open-pack", entitlement: "old-sealed" },
      Date.now(),
    ).state;
    await db.query("update credits_sandbox.state set document=$1", [opened]);
    assert.deepEqual(
      opened.economy!.packs["old-sealed"].cards,
      s.economy!.packs["old-sealed"].cards,
    );
  } finally {
    await db.close();
  }
});

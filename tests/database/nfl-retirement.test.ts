import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import {
  marketplaceFixture,
  marketActors,
} from "../fixtures/marketplace-state";
import { executeCredits } from "../../src/core/credits-sandbox";
import { cleanTestEconomy } from "../../src/core/nfl-test-cleanup";
import { rarityConfiguration } from "../../src/core/card-rarity";
test("audited test retirement preserves permanent allocations and wallet; unauthorized retirement/resurrection denied", async () => {
  const pg = new PGlite();
  try {
    await pg.exec(
      "create schema auth;create table auth.users(id uuid primary key);create role anon;create role authenticated;create role service_role;create role docked_beta_app;",
    );
    for (const f of [
      "20261011100229_financial_test_wallet.sql",
      "20261012101915_lifetime_card_economy.sql",
    ])
      await pg.exec(readFileSync("supabase/migrations/" + f, "utf8"));
    await pg.exec(
      `create schema nfl_roster;create function nfl_roster.immutable() returns trigger language plpgsql as $$begin raise exception 'immutable';end$$;grant usage on schema nfl_roster to docked_beta_app;`,
    );
    await pg.exec(
      readFileSync(
        "supabase/migrations/20261017093142_audited_nfl_test_retirements.sql",
        "utf8",
      ),
    );
    let s = marketplaceFixture();
    s = executeCredits(
      s,
      marketActors[0],
      "retirement-fixture",
      {
        kind: "buy-pack",
        product: "standard-nine-seven-test-v2",
        configuration: "standard-nine-seven-test-v2",
        policy: s.policy.version,
        confirmed: true,
      },
      Date.now(),
    ).state;
    await pg.query(
      "insert into credits_sandbox.rarity_configuration values($1,$2)",
      [rarityConfiguration.version, rarityConfiguration],
    );
    for (const p of Object.values(s.economy!.players))
      await pg.query(
        "insert into credits_sandbox.permanent_players values($1,$2,$3,$4,$5,$6)",
        [p.id, p.sport, p.provider, p.providerId, p.assetKind, p],
      );
    for (const p of Object.values(s.economy!.products))
      await pg.query(
        "insert into credits_sandbox.pack_configuration values($1,$2)",
        [p.version, p],
      );
    await pg.query("insert into credits_sandbox.state values(true,0,$1)", [s]);
    await pg.query("update credits_sandbox.state set document=$1", [s]);
    const id = Object.keys(s.economy!.instances)[0],
      card = s.economy!.instances[id];
    const approval = {
      playerId: card.playerId,
      name: "Fixture only",
      reason: "unsupported" as const,
      evidence: ["https://example.test/fixture"],
      cards: [id],
    };
    const cleaned = cleanTestEconomy(s, [approval]).state;
    await assert.rejects(
      pg.query("update credits_sandbox.state set document=$1", [cleaned]),
      /Unapproved/,
    );
    await pg.exec("set role docked_beta_app");
    await assert.rejects(
      pg.query(
        "insert into nfl_roster.retired_test_cards(card_id,allocation,ownership,history,approval)values($1,$2,$3,$4,$5)",
        [id, card, s.commerce.cards[id], s.cards[id], approval],
      ),
      /permission/,
    );
    await pg.exec("reset role");
    await pg.query(
      "insert into nfl_roster.retired_test_cards(card_id,allocation,ownership,history,approval)values($1,$2,$3,$4,$5)",
      [id, card, s.commerce.cards[id], s.cards[id], approval],
    );
    await pg.query("update credits_sandbox.state set document=$1", [cleaned]);
    await pg.exec("set role docked_beta_app");
    await pg.query("update credits_sandbox.state set document=$1", [cleaned]);
    await assert.rejects(
      pg.query("update credits_sandbox.state set document=$1", [s]),
      /Retired scarcity/,
    );
    assert.deepEqual(cleaned.journal, s.journal);
    assert.deepEqual(cleaned.lots, s.lots);
    assert.deepEqual(cleaned.economy!.definitions, s.economy!.definitions);
    assert.equal(
      (
        await pg.query<{ n: number }>(
          "select count(*)::int n from credits_sandbox.card_instances",
        )
      ).rows[0].n,
      Object.keys(s.economy!.instances).length,
    );
    await assert.rejects(
      pg.query("delete from credits_sandbox.card_instances"),
      /permission/,
    );
  } finally {
    await pg.close();
  }
});

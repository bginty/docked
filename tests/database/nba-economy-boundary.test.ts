import test from "node:test";
import assert from "node:assert/strict";
import { multiSportDatabase } from "../fixtures/multi-sport-db";
import { nbaWeeklyConfiguration } from "../../src/core/sport-configuration";
import { initialMemberTestCredits } from "../../src/core/member-test-wallet";
import {
  initialCardEconomy,
  prepareNbaTestProducts,
  type EconomyPlayer,
} from "../../src/core/card-economy";
import { executeCredits } from "../../src/core/credits-sandbox";
import { rarityConfiguration } from "../../src/core/card-rarity";

test("synthetic NBA allocations remain outside permanent inventory with admission, immutable serials and disabled runtime writes", async () => {
  const db = await multiSportDatabase(nbaWeeklyConfiguration, true);
  try {
    // Local transport fixture, not an authenticated hosted acceptance claim.
    await db.pg
      .exec(`create or replace function beta_private.beta_gameplay_identity(p_user uuid) returns boolean language sql as $$select true$$;
      create or replace function beta_private.admitted(p_user uuid) returns boolean language sql as $$select true$$;
      create or replace function beta_private.gameplay_mfa_required(p_user uuid) returns boolean language sql as $$select false$$;`);
    await db.q("select set_config('docked.nba_private_beta','enabled',false)");
    await db.q(
      "insert into sports_feed.nba_beta_control values(true,true,'Isolated SQL fixture',now())",
    );
    await db.q(
      "insert into sports_feed.nba_beta_access(user_id,enabled,authority,expires_at) values($1,true,'Isolated SQL fixture','infinity')",
      [db.user],
    );
    await db.asUser(db.user);
    await db.q("select credits_sandbox.assert_nba_fixture_member($1)", [
      db.user,
    ]);
    await assert.rejects(
      db.q("select credits_sandbox.assert_nba_fixture_member($1)", [db.other]),
      /counterparty/,
    );
    await db.q("update auth.users set email_confirmed_at=null where id=$1", [
      db.user,
    ]);
    await assert.rejects(
      db.q("select credits_sandbox.assert_nba_fixture_member($1)", [db.user]),
      /NBA beta access/,
    );
    await db.q("update auth.users set email_confirmed_at=now() where id=$1", [
      db.user,
    ]);

    const now = Date.now();
    const players: EconomyPlayer[] = Array.from({ length: 18 }, (_, i) => ({
      id: `nba-fixture-${i}`,
      providerId: `nba-fixture-${i}`,
      provider: "fixture",
      synthetic: true,
      sport: "basketball",
      assetKind: "player",
      name: `Synthetic NBA ${i}`,
      position: ["PG", "SG", "SF", "PF", "C"][i % 5],
      currentTeam: "Test City",
      status: "active",
      observedAt: now,
      sourceRevision: "isolated-v1",
      presentation: "docked-basketball-v1",
    }));
    const nflPlayers: EconomyPlayer[] = Array.from({ length: 12 }, (_, i) => ({
      ...players[i],
      id: `nfl-fixture-${i}`,
      providerId: `nfl-fixture-${i}`,
      sport: "nfl",
      position: "QB",
      name: `Synthetic NFL ${i}`,
    }));
    let state = initialMemberTestCredits();
    state.economy = initialCardEconomy(nflPlayers, now);
    const products = prepareNbaTestProducts(state.economy, now);
    Object.assign(
      state.economy.players,
      Object.fromEntries(players.map((p) => [p.id, p])),
    );
    await db.q(
      "insert into credits_sandbox.rarity_configuration values($1,$2)",
      [rarityConfiguration.version, JSON.stringify(rarityConfiguration)],
    );
    for (const p of players)
      await db.q(
        "insert into credits_sandbox.nba_fixture_players values($1,$2)",
        [p.id, JSON.stringify(p)],
      );
    for (const p of nflPlayers)
      await db.q(
        "insert into credits_sandbox.permanent_players values($1,$2,$3,$4,$5,$6)",
        [
          p.id,
          p.sport,
          p.provider,
          p.providerId,
          p.assetKind,
          JSON.stringify(p),
        ],
      );
    for (const identity of [
      { ...players[0], id: "nba-fixture-real", synthetic: false },
      { ...players[0], id: "nba-fixture-real", provider: "sportsdataio" },
      { ...players[0], id: "nba-fixture-real", position: "G" },
    ])
      await assert.rejects(
        db.q("insert into credits_sandbox.nba_fixture_players values($1,$2)", [
          identity.id,
          JSON.stringify(identity),
        ]),
        /check constraint/,
      );
    await assert.rejects(
      db.q(
        "insert into credits_sandbox.permanent_players values($1,$2,$3,$4,$5,$6)",
        [
          players[0].id,
          "basketball",
          "fixture",
          players[0].id,
          "player",
          JSON.stringify(players[0]),
        ],
      ),
      /check constraint/,
    );
    for (const p of Object.values(state.economy.products))
      await db.q(
        "insert into credits_sandbox.pack_configuration values($1,$2)",
        [p.version, JSON.stringify(p)],
      );
    await db.q("insert into credits_sandbox.state values(true,0,$1)", [
      JSON.stringify(initialMemberTestCredits()),
    ]);
    await db.q("update credits_sandbox.state set document=$1", [
      JSON.stringify(state),
    ]);
    state.economy.nbaTestAllocation!.enabled = true;
    state.economy.activeProductVersions = Object.keys(state.economy.products);
    await db.pg.exec("set role docked_beta_app");
    await assert.rejects(
      db.q("update credits_sandbox.state set document=$1", [
        JSON.stringify(state),
      ]),
      /Operator NBA/,
    );
    await db.pg.exec("reset role");
    await db.q("update credits_sandbox.state set document=$1", [
      JSON.stringify(state),
    ]);
    state = executeCredits(
      state,
      { id: db.other, role: "reviewer", aal: "aal2" },
      "fixture-grant",
      {
        kind: "promotion",
        member: db.user,
        amount: 10000,
        campaign: "synthetic",
        reason: "Isolated SQL acceptance only",
        confirmed: true,
        redeemable: false,
      },
      now,
    ).state;
    await db.q("update credits_sandbox.state set document=$1", [
      JSON.stringify(state),
    ]);
    state = executeCredits(
      state,
      { id: db.user, role: "member" },
      "nfl-fixture-pack",
      {
        kind: "buy-pack",
        product: "standard-nine-test-v1",
        configuration: "standard-nine-test-v1",
        policy: state.policy.version,
        confirmed: true,
      },
      now,
    ).state;
    await db.q("update credits_sandbox.state set document=$1", [
      JSON.stringify(state),
    ]);
    const nflBefore = await db.q(
      "select * from credits_sandbox.card_instances order by id",
    );
    assert.equal(nflBefore.length, 9);
    const before = structuredClone(state);
    const product = products.find((p) => p.type === "STANDARD")!;
    const command = {
      kind: "buy-pack",
      product: product.id,
      configuration: product.version,
      policy: state.policy.version,
      confirmed: true,
    };
    state = executeCredits(
      state,
      { id: db.user, role: "member" },
      "nba-fixture-pack",
      command,
      now,
    ).state;
    // Shipping this migration alone cannot enable purchases, even with the
    // aggregate flag set: runtime INSERT privileges deliberately remain absent.
    await db.pg.exec("set role docked_beta_app");
    await assert.rejects(
      db.q("update credits_sandbox.state set document=$1", [
        JSON.stringify(state),
      ]),
      /permission denied/,
    );
    await db.pg.exec("reset role");
    assert.deepEqual(
      (await db.q("select document from credits_sandbox.state"))[0].document,
      before,
    );
    await db.q("update credits_sandbox.state set document=$1", [
      JSON.stringify(state),
    ]);
    assert.equal(
      (
        await db.q(
          "select count(*)::int n from credits_sandbox.nba_fixture_instances",
        )
      )[0].n,
      9,
    );
    assert.equal(
      (
        await db.q("select count(*)::int n from credits_sandbox.card_instances")
      )[0].n,
      9,
    );
    assert.equal(
      (
        await db.q(
          "select count(*)::int n from credits_sandbox.permanent_players",
        )
      )[0].n,
      12,
    );
    assert.deepEqual(
      await db.q("select * from credits_sandbox.card_instances order by id"),
      nflBefore,
    );
    assert.deepEqual(
      executeCredits(
        state,
        { id: db.user, role: "member" },
        "nba-fixture-pack",
        command,
        now + 1,
      ).state,
      state,
    );
    await db.q("update credits_sandbox.state set document=$1", [
      JSON.stringify(state),
    ]);
    const card = state.economy!.packs["nba-fixture-pack"].cards[0];
    const changed = structuredClone(state);
    changed.economy!.instances[card].serial++;
    await assert.rejects(
      db.q("update credits_sandbox.state set document=$1", [
        JSON.stringify(changed),
      ]),
      /immutable/,
    );
    const opened = executeCredits(
      state,
      { id: db.user, role: "member" },
      "nba-open",
      { kind: "open-pack", entitlement: "nba-fixture-pack" },
      now + 1,
    ).state;
    await db.q(
      "update sports_feed.nba_beta_access set enabled=false where user_id=$1",
      [db.user],
    );
    await assert.rejects(
      db.q("update credits_sandbox.state set document=$1", [
        JSON.stringify(opened),
      ]),
      /NBA beta access/,
    );
    await db.q(
      "update sports_feed.nba_beta_access set enabled=true where user_id=$1",
      [db.user],
    );
    await db.q("update credits_sandbox.state set document=$1", [
      JSON.stringify(opened),
    ]);
    for (const role of [
      "anon",
      "authenticated",
      "service_role",
      "docked_beta_app",
    ]) {
      assert.equal(
        (
          await db.q(
            "select has_table_privilege($1,'credits_sandbox.nba_fixture_players','INSERT') ok",
            [role],
          )
        )[0].ok,
        false,
      );
      assert.equal(
        (
          await db.q(
            "select has_table_privilege($1,'credits_sandbox.nba_fixture_instances','INSERT') ok",
            [role],
          )
        )[0].ok,
        false,
      );
    }
    await assert.rejects(
      db.q("delete from credits_sandbox.nba_fixture_instances"),
      /immutable/,
    );
    await assert.rejects(
      db.q("update credits_sandbox.nba_fixture_players set identity=identity"),
      /immutable/,
    );
  } finally {
    await db.pg.close();
  }
});

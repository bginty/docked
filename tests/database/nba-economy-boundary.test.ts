import test from "node:test";
import assert from "node:assert/strict";
import { multiSportDatabase } from "../fixtures/multi-sport-db";
import {
  nbaWeeklyConfiguration,
  aflConfiguration,
  nrlConfiguration,
} from "../../src/core/sport-configuration";
import { fixtureSports } from "../../src/core/fixture-sports";
import { initialMemberTestCredits } from "../../src/core/member-test-wallet";
import {
  initialCardEconomy,
  prepareSportTestProducts,
  type EconomyPlayer,
} from "../../src/core/card-economy";
import { executeCredits } from "../../src/core/credits-sandbox";
import { sandboxRecommendation } from "../../src/core/sport-sandbox";
import { rarityConfiguration } from "../../src/core/card-rarity";
import { executePrivateOffer } from "../../src/core/private-card-offers";
import { randomUUID } from "node:crypto";

for (const config of [
  nbaWeeklyConfiguration,
  aflConfiguration,
  nrlConfiguration,
])
  test(`${config.label} synthetic allocation, atomic lineup inventory and admission preserve permanent NFL inventory`, async () => {
    const sport = config.id as keyof typeof fixtureSports;
    const { prefix } = fixtureSports[sport];
    const db = await multiSportDatabase(config, true);
    try {
      // Local transport fixture, not an authenticated hosted acceptance claim.
      await db.pg
        .exec(`create or replace function beta_private.beta_gameplay_identity(p_user uuid) returns boolean language sql as $$select true$$;
      create or replace function beta_private.admitted(p_user uuid) returns boolean language sql as $$select true$$;
      create or replace function beta_private.gameplay_mfa_required(p_user uuid) returns boolean language sql as $$select false$$;`);
      await db.q(
        "select set_config('docked.nba_private_beta','enabled',false)",
      );
      await db.q(
        "insert into sports_feed.nba_beta_control values(true,true,'Isolated SQL fixture',now())",
      );
      await db.q(
        "insert into sports_feed.nba_beta_access(user_id,enabled,authority,expires_at) values($1,true,'Isolated SQL fixture','infinity')",
        [db.user],
      );
      await db.asUser(db.user);
      await db.q(
        "select set_config('docked.private_beta_sport',$1,false),set_config('docked.sports_private_beta','enabled',false)",
        [sport],
      );
      if (sport !== "basketball")
        await db.q(
          "update sports_feed.private_beta_sports set enabled=true where sport=$1",
          [sport],
        );
      await db.q("select credits_sandbox.assert_nba_fixture_member($1)", [
        db.user,
      ]);
      await assert.rejects(
        db.q("select credits_sandbox.assert_nba_fixture_member($1)", [
          db.other,
        ]),
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
      const players: EconomyPlayer[] = Array.from(
        { length: Math.min(18, db.inventories[db.user].length) },
        (_, i) => ({
          id: `${prefix}-fixture-${i}`,
          providerId: `${prefix}-fixture-${i}`,
          provider: "fixture",
          synthetic: true,
          fixturePlayerId: db.inventories[db.user][i].player_id,
          sport,
          assetKind: "player",
          name: `Synthetic NBA ${i}`,
          position: db.inventories[db.user][i].position,
          currentTeam: "Test City",
          status: "active",
          observedAt: now,
          sourceRevision: "isolated-v1",
          presentation: "docked-basketball-v1",
        }),
      );
      const nflPlayers: EconomyPlayer[] = Array.from(
        { length: 12 },
        (_, i) => ({
          ...players[i % players.length],
          id: `nfl-fixture-${i}`,
          providerId: `nfl-fixture-${i}`,
          sport: "nfl",
          position: "QB",
          name: `Synthetic NFL ${i}`,
        }),
      );
      let state = initialMemberTestCredits();
      state.economy = initialCardEconomy(nflPlayers, now);
      const products = prepareSportTestProducts(state.economy, sport, now);
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
          db.q(
            "insert into credits_sandbox.nba_fixture_players values($1,$2)",
            [identity.id, JSON.stringify(identity)],
          ),
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
      if (sport === "basketball")
        state.economy.nbaTestAllocation!.enabled = true;
      else state.economy.fixtureTestAllocation![sport]!.enabled = true;
      state.economy.activeProductVersions = Object.keys(state.economy.products);
      await db.pg.exec("set role docked_beta_app");
      await assert.rejects(
        db.q("update credits_sandbox.state set document=$1", [
          JSON.stringify(state),
        ]),
        /Operator.*fixture/,
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
        /permission denied|row-level security/,
      );
      await db.pg.exec("reset role");
      assert.deepEqual(
        (await db.q("select document from credits_sandbox.state"))[0].document,
        before,
      );
      await db.q(
        "select set_config('docked.fixture_commerce','enabled',false)",
      );
      await db.pg.exec("set role docked_beta_app");
      await db.q("update credits_sandbox.state set document=$1", [
        JSON.stringify(state),
      ]);
      await db.pg.exec("reset role");
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
          await db.q(
            "select count(*)::int n from credits_sandbox.card_instances",
          )
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
      const inventory = (
        await db.q(
          "select cards from sports_feed.sport_sandbox_inventory where user_id=$1 and sport=$2",
          [db.user, sport],
        )
      )[0].cards;
      assert.equal(
        inventory.filter(
          (c: any) => c.inventory_source === "credits-fixture-v1",
        ).length,
        9,
      );
      assert.equal(
        inventory.filter(
          (c: any) => c.inventory_source !== "credits-fixture-v1",
        ).length,
        db.inventories[db.user].length,
      );
      assert.ok(
        inventory.every(
          (c: any) => c.sport === sport && c.owner_id === db.user,
        ),
      );
      for (const c of inventory.filter(
        (c: any) => c.inventory_source === "credits-fixture-v1",
      ))
        assert.ok(
          db.inventories[db.user].some(
            (base) =>
              base.player_id === c.player_id && base.position === c.position,
          ),
        );
      // A different sport cannot insert even with a verified session.
      await db.q(
        "select set_config('docked.fixture_commerce','enabled',false)",
      );
      assert.equal(
        (
          await db.q("select credits_sandbox.fixture_write_allowed($1) ok", [
            players[0].id,
          ])
        )[0].ok,
        true,
      );
      await db.q(
        "select set_config('docked.private_beta_sport','football',false)",
      );
      assert.equal(
        (
          await db.q("select credits_sandbox.fixture_write_allowed($1) ok", [
            players[0].id,
          ])
        )[0].ok,
        false,
      );
      await db.q("select set_config('docked.private_beta_sport',$1,false)", [
        sport,
      ]);
      state = opened;
      for (const [i, u] of [db.user, db.other].entries()) {
        await db.q(
          "insert into beta_private.admissions(email,user_id,token_digest,request_id,expires_at,status)values($1,$2,$3,gen_random_uuid(),now()+interval '1 day','reserved')",
          [`fixture${i}@example.invalid`, u, String(i + 1).repeat(64)],
        );
        await db.q(
          "update beta_private.admissions set status='accepted',accepted_at=now(),country='AU',state='VIC',age_attested=true,policy_digest='fixture',policy_versions='{\"terms\":\"isolated\"}' where user_id=$1",
          [u],
        );
        await db.q(
          "insert into beta_public.profiles(id,country,state,age_attested,accepted_version)values($1,'AU','VIC',true,'isolated')",
          [u],
        );
        await db.q(
          "insert into beta_private.social_profiles(id,user_id,handle,display_name)values($1,$1,$2,$3)",
          [u, `fixture_${i}`, `Fixture ${i}`],
        );
      }
      const sharedCard = inventory.find(
        (c: any) => c.inventory_source === "credits-fixture-v1",
      );
      const sharedSnapshot = JSON.stringify([sharedCard]);
      const sharedPost = (
        await db.q(
          "insert into beta_private.social_posts(author_id,kind,body,sport,card_snapshots)values($1,'discussion','Fictional test card',$2,$3) returning id",
          [db.user, sport, sharedSnapshot],
        )
      )[0].id;
      assert.equal(
        (
          await db.q("select sports_feed.fixture_social_visible($1,$2) ok", [
            sharedSnapshot,
            db.other,
          ])
        )[0].ok,
        false,
      );
      assert.equal(
        (
          await db.q(
            "select sports_feed.fixture_social_visible($1,gen_random_uuid()) ok",
            [sharedSnapshot],
          )
        )[0].ok,
        false,
      );
      const current = await db.state();
      const selections = sandboxRecommendation(current, db.rounds.OPEN1).picks;
      const packed = inventory.find(
        (c: any) => c.inventory_source === "credits-fixture-v1",
      );
      const slot = config.slots.find((s) =>
        s.positions.includes(packed.position),
      )!;
      const selected = selections.map((s) =>
        s.slot === slot.id ? { slot: s.slot, card: packed.id } : s,
      );
      // If Auto Select already used another copy of this player, retain its slot.
      const samePlayer = selections.find(
        (s) =>
          inventory.find((c: any) => c.id === s.card)?.player_id ===
          packed.player_id,
      );
      const saved = samePlayer
        ? selections.map((s) =>
            s.slot === samePlayer.slot ? { slot: s.slot, card: packed.id } : s,
          )
        : selected;
      await db.command("seven_enter", db.rounds.OPEN1, saved, 0);
      const listed = executeCredits(
        state,
        { id: db.user, role: "member" },
        "fixture-list",
        { kind: "list", card: packed.id, price: 1000, preference: "both" },
        now + 2,
      ).state;
      await assert.rejects(
        db.q("update credits_sandbox.state set document=$1", [
          JSON.stringify(listed),
        ]),
        /unlocked submitted team/,
      );
      assert.deepEqual(
        (await db.q("select document from credits_sandbox.state"))[0].document,
        state,
      );
      await db.q("select set_config('qa.now','2099-02-03T00:00:00Z',false)");
      await db.state();
      await db.q("update credits_sandbox.state set document=$1", [
        JSON.stringify(listed),
      ]);
      state = listed;
      await db.q(
        "insert into sports_feed.nba_beta_access(user_id,enabled,authority,expires_at)values($1,true,'Isolated transfer test','infinity')",
        [db.other],
      );
      state = executeCredits(
        state,
        { id: db.user, role: "reviewer", aal: "aal2" },
        "buyer-funds",
        {
          kind: "promotion",
          member: db.other,
          amount: 2000,
          campaign: "synthetic",
          reason: "Isolated SQL test",
          confirmed: true,
          redeemable: false,
        },
        now + 3,
      ).state;
      await db.q("update credits_sandbox.state set document=$1", [
        JSON.stringify(state),
      ]);
      const locked = (
        await db.q(
          "select snapshot from beta_fantasy.entries where competition_id=$1 and user_id=$2",
          [db.rounds.OPEN1, db.user],
        )
      )[0].snapshot;
      await db.asUser(db.other);
      const sold = executeCredits(
        state,
        { id: db.other, role: "member" },
        "fixture-sale",
        {
          kind: "buy",
          listing: "fixture-list",
          expectedPrice: 1000,
          policy: state.policy.version,
          confirmed: true,
        },
        now + 4,
      ).state;
      await db.pg.transaction(async (tx) => {
        for (const j of sold.journal.slice(state.journal.length))
          await tx.query("insert into credits_sandbox.journal values($1,$2)", [
            j.id,
            JSON.stringify(j),
          ]);
        await tx.query("update credits_sandbox.state set document=$1", [
          JSON.stringify(sold),
        ]);
      });
      assert.equal(sold.listings["fixture-list"].receipt!.fee, 50);
      assert.equal(sharedCard.id, packed.id);
      assert.deepEqual(
        (
          await db.q(
            "select card_snapshots from beta_private.social_posts where id=$1",
            [sharedPost],
          )
        )[0].card_snapshots,
        JSON.parse(sharedSnapshot),
      );
      assert.equal(
        (
          await db.q("select sports_feed.fixture_social_visible($1,$2) ok", [
            sharedSnapshot,
            db.other,
          ])
        )[0].ok,
        true,
      );
      await assert.rejects(
        db.q(
          "insert into beta_private.social_posts(author_id,kind,body,sport,card_snapshots)values($1,'discussion','Attempt after transfer',$2,$3)",
          [db.user, sport, sharedSnapshot],
        ),
        /owned opened fixture/,
      );
      await db.q(
        "update sports_feed.nba_beta_access set enabled=false where user_id=$1",
        [db.other],
      );
      assert.equal(
        (
          await db.q("select sports_feed.fixture_social_visible($1,$2) ok", [
            sharedSnapshot,
            db.other,
          ])
        )[0].ok,
        false,
      );
      await db.q(
        "update sports_feed.nba_beta_access set enabled=true where user_id=$1",
        [db.other],
      );
      const transferred = (
        await db.q(
          "select cards from sports_feed.sport_sandbox_inventory where user_id=$1 and sport=$2",
          [db.other, sport],
        )
      )[0].cards;
      assert.ok(
        transferred.some(
          (c: any) =>
            c.id === packed.id &&
            c.player_id === packed.player_id &&
            c.owner_id === db.other,
        ),
      );
      assert.ok(
        !(
          await db.q(
            "select cards from sports_feed.sport_sandbox_inventory where user_id=$1 and sport=$2",
            [db.user, sport],
          )
        )[0].cards.some((c: any) => c.id === packed.id),
      );
      assert.deepEqual(
        (
          await db.q(
            "select snapshot from beta_fantasy.entries where competition_id=$1 and user_id=$2",
            [db.rounds.OPEN1, db.user],
          )
        )[0].snapshot,
        locked,
      );
      // The same database guards must allow the existing private swap + credit
      // settlement, once both counterparties and every card are isolated fixtures.
      state = sold;
      const give = state.economy!.packs["nba-fixture-pack"].cards.find(
        (id) => id !== packed.id,
      )!;
      const offerId = randomUUID(),
        acceptId = randomUUID();
      const permission = {
        allowed: true,
        minimum: null,
        swaps: true,
        combinedPolicy: "credit-commission-floor-v1" as const,
      };
      await db.asUser(db.user);
      const offered = executePrivateOffer(
        state,
        { id: db.user, role: "member" },
        offerId,
        {
          kind: "private-offer",
          card: packed.id,
          offeredCards: [give],
          price: 100,
        },
        now + 5,
        permission,
      ).state;
      await db.q("update credits_sandbox.state set document=$1", [
        JSON.stringify(offered),
      ]);
      await db.asUser(db.other);
      const accepted = executePrivateOffer(
        offered,
        { id: db.other, role: "member" },
        acceptId,
        { kind: "private-accept", offer: offerId },
        now + 6,
        permission,
      );
      await db.pg.transaction(async (tx) => {
        for (const journal of accepted.state.journal.slice(
          offered.journal.length,
        ))
          await tx.query("insert into credits_sandbox.journal values($1,$2)", [
            journal.id,
            JSON.stringify(journal),
          ]);
        await tx.query("update credits_sandbox.state set document=$1", [
          JSON.stringify(accepted.state),
        ]);
      });
      assert.equal(accepted.state.commerce.cards[packed.id].owner, db.user);
      assert.equal(accepted.state.commerce.cards[give].owner, db.other);
      const replay = executePrivateOffer(
        accepted.state,
        { id: db.other, role: "member" },
        acceptId,
        { kind: "private-accept", offer: offerId },
        now + 7,
        permission,
      );
      assert.deepEqual(replay.state, accepted.state);
      assert.deepEqual(replay.result, accepted.result);
      assert.deepEqual(
        await db.q("select * from credits_sandbox.card_instances order by id"),
        nflBefore,
      );
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
          role === "docked_beta_app",
        );
      }
      await assert.rejects(
        db.q("delete from credits_sandbox.nba_fixture_instances"),
        /immutable/,
      );
      await assert.rejects(
        db.q(
          "update credits_sandbox.nba_fixture_players set identity=identity",
        ),
        /immutable/,
      );
    } finally {
      await db.pg.close();
    }
  });

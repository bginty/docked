import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { multiSportDatabase } from "../fixtures/multi-sport-db";
import { initialMemberTestCredits } from "../../src/core/member-test-wallet";
test("owned collection reads ledgers only, paginates consistently, isolates sports/accounts and follows transfers", async () => {
  const db = await multiSportDatabase();
  try {
    // Existing fixture supplies only transport identities; production function guards remain tested below.
    await db.pg.exec(
      `create or replace function beta_private.beta_gameplay_identity(p_user uuid) returns boolean language sql as $$select true$$;create or replace function beta_private.gameplay_mfa_required(p_user uuid) returns boolean language sql as $$select false$$;`,
    );
    await db.q(
      "insert into sports_feed.nba_beta_control values(true,true,'Isolated test',clock_timestamp())",
    );
    for (const u of [db.user, db.other])
      await db.q(
        "insert into sports_feed.nba_beta_access(user_id,enabled,authority,expires_at)values($1,true,'Isolated test','infinity')",
        [u],
      );
    await db.q(
      "update sports_feed.private_beta_sports set enabled=true,authority='Isolated test'",
    );
    await db.q(
      "select set_config('docked.nba_private_beta','enabled',false),set_config('docked.sports_private_beta','enabled',false),set_config('docked.private_beta_sport','afl',false)",
    );
    const read = async (f: Record<string, unknown> = { sport: "afl" }) =>
      (
        await db.q("select beta_fantasy.owned_collection_page($1) result", [f])
      )[0].result;
    assert.ok(db.inventories[db.user].length > 20);
    assert.equal(
      (await read()).total,
      0,
      "Free PLAY selections are not collectibles",
    );
    const s: any = initialMemberTestCredits();
    s.economy = {
      instances: {},
      players: {},
      packs: {},
      definitions: {},
      products: {},
    };
    for (const sport of ["nfl", "basketball", "afl", "nrl"])
      for (let i = 0; i < 101; i++) {
        const id = `owned-${sport}-${i}`,
          playerId = `player-${sport}-${i}`,
          pack = `pack-${sport}-${i}`;
        const owner = i === 100 ? db.other : db.user;
        s.commerce.cards[id] = {
          owner,
          tier: i % 2 ? "RARE" : "CORE",
          sport,
          reserved: null,
        };
        s.cards[id] = { history: [{ to: owner, at: 10000 + i }], owner };
        s.entitlements[pack] = { status: i === 99 ? "ALLOCATED" : "OPENED" };
        s.economy.players[playerId] = {
          id: playerId,
          name: `Isolated Player ${String(i).padStart(3, "0")}`,
          sport,
          currentTeam: i % 2 ? "Away" : "HOU",
          position: i % 2 ? "G" : "F",
        };
        s.economy.instances[id] = {
          playerId,
          source: pack,
          rarity: i % 2 ? "RARE" : "CORE",
          serial: i + 1,
        };
      }
    await db.q("insert into credits_sandbox.state values(true,0,$1)", [s]);
    for (const sport of ["nfl", "basketball", "afl", "nrl"]) {
      await db.q("select set_config('docked.private_beta_sport',$1,false)", [
        sport,
      ]);
      const first = await read({ sport });
      assert.equal(first.total, 99);
      assert.equal(first.rows.length, 18);
      assert.deepEqual(first.counts, { CORE: 50, RARE: 49 });
      const seen = new Set<string>();
      for (let offset = 0; offset < 99; offset += 18) {
        const p = await read({ sport, offset, revision: first.revision });
        for (const c of p.rows) {
          assert.equal(seen.has(c.id), false);
          seen.add(c.id);
        }
        assert.equal(p.changed, false);
      }
      assert.equal(seen.size, 99);
      assert.equal((await read({ sport, rarity: "RARE" })).filtered, 49);
      assert.equal(
        (await read({ sport, search: "#001" })).rows[0].id,
        `owned-${sport}-0`,
      );
      assert.equal(
        (await read({ sport, search: "Houston", search_teams: ["HOU"] }))
          .filtered,
        50,
      );
      assert.equal(
        (await read({ sport, position: "G", team: "Away" })).filtered,
        49,
      );
      assert.equal(
        (await read({ sport, sort: "name" })).rows[0].id,
        `owned-${sport}-0`,
      );
      assert.equal(
        (await read({ sport, sort: "serial" })).rows[0].id,
        `owned-${sport}-0`,
      );
      assert.equal(
        (await read({ sport, offset: 18, revision: "stale" })).changed,
        true,
      );
      await db.asUser(db.other);
      assert.equal((await read({ sport })).total, 1);
      await db.asUser(db.user);
    }
    // No new grant, wallet or ownership writes performed by reads.
    assert.deepEqual(
      (await db.q("select document from credits_sandbox.state"))[0].document,
      s,
    );
    // Exercise real legacy issuance/ownership rows, including genuine owned Core.
    const player = randomUUID(),
      edition = randomUUID(),
      card = randomUUID();
    await db.q(
      "insert into beta_fantasy.players(id,name,sport,team,position,colour,shirt,status,first_season)values($1,'Owned Legacy','nfl','HOU','QB','#123456',1,'active','2099')",
      [player],
    );
    await db.q(
      "insert into beta_fantasy.editions(id,player_id,tier,season,kind,max_supply,status)values($1,$2,'CORE','2099','regular',10000,'launched')",
      [edition, player],
    );
    await db.q(
      "insert into beta_fantasy.cards(id,edition_id,serial,owner_id,tradeable)values($1,$2,1,$3,false)",
      [card, edition, db.user],
    );
    const before = await read({ sport: "nfl" });
    assert.equal(before.total, 100);
    await db.q("update beta_fantasy.cards set owner_id=$1 where id=$2", [
      db.other,
      card,
    ]);
    assert.equal(
      (await read({ sport: "nfl", revision: before.revision, offset: 18 }))
        .changed,
      true,
    );
    assert.equal((await read({ sport: "nfl" })).total, 99);
    await db.asUser(db.other);
    assert.equal((await read({ sport: "nfl" })).total, 2);
    for (const role of ["anon", "authenticated", "service_role", "docked_app"])
      assert.equal(
        (
          await db.q(
            "select has_function_privilege($1,'beta_fantasy.owned_collection_page(jsonb)','EXECUTE') ok",
            [role],
          )
        )[0].ok,
        false,
      );
    assert.equal(
      (
        await db.q(
          "select has_function_privilege('docked_beta_app','beta_fantasy.owned_collection_page(jsonb)','EXECUTE') ok",
        )
      )[0].ok,
      true,
    );
    await db.q(
      "update sports_feed.nba_beta_access set enabled=false where user_id=$1",
      [db.other],
    );
    await db.q("select set_config('docked.private_beta_sport','afl',false)");
    await assert.rejects(read(), /beta access/);
    await db.pg.exec(
      "create or replace function beta_private.active_member_session() returns boolean language sql as $$select false$$;",
    );
    await assert.rejects(read({ sport: "nfl" }), /Active admitted session/);
  } finally {
    await db.pg.close();
  }
});

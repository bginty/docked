import test from "node:test";
import assert from "node:assert/strict";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { multiSportDatabase } from "../fixtures/multi-sport-db";
import { initialMemberTestCredits } from "../../src/core/member-test-wallet";
import { CommercialLedger } from "../../src/server/commercial-ledger";
import { CommercialMemberView } from "../../src/server/commercial-member-view";
import {
  commercialPack,
  commercialPolicyVersion,
  commercialProducts,
} from "../../src/core/commercial-billing";
import { rarityRule } from "../../src/core/card-rarity";

test(
  "Commercial collection preserves historical custody beside paid cards, pagination, counts and permissions",
  { skip: !process.env.AUSTRALIAN_SALARY_TEST_DB },
  async () => {
    const d = await multiSportDatabase();
    try {
      assert(
        d.native,
        "Real isolated PostgreSQL required for repository queries",
      );
      const sql = d.native;
      const state: any = initialMemberTestCredits();
      state.economy = {
        instances: {},
        players: {},
        packs: {},
        definitions: {},
        products: {},
      };
      const legacyIds: string[] = [];
      for (let i = 0; i < 25; i++) {
        const id = randomUUID(),
          player = randomUUID(),
          pack = randomUUID();
        legacyIds.push(id);
        const owner = i === 24 ? d.other : d.user;
        const sport = i === 23 ? "basketball" : "nfl";
        state.commerce.cards[id] = {
          owner,
          tier: "RARE",
          sport,
          reserved: null,
        };
        state.cards[id] = {
          owner,
          history: [{ to: owner, at: 1793877442000 + i }],
        };
        state.entitlements[pack] = {
          member: owner,
          status: i === 22 ? "ALLOCATED" : "OPENED",
        };
        state.economy.players[player] = {
          id: player,
          name: `Preserved ${String(i).padStart(2, "0")}`,
          sport,
          currentTeam: "HOU",
          position: "QB",
          status: "active",
          synthetic: false,
        };
        state.economy.instances[id] = {
          id,
          playerId: player,
          source: pack,
          rarity: "RARE",
          serial: i + 1,
          lifetimeCap: 5000,
        };
      }
      // Read-only projection fixture; no claim to exercise beta issuance guards.
      await d.pg.exec("alter table credits_sandbox.state disable trigger user");
      await d.q("insert into credits_sandbox.state values(true,0,$1)", [state]);
      await d.pg.exec("alter table credits_sandbox.state enable trigger user");
      const before = (
        await d.q(
          "select md5(document::text) h from credits_sandbox.state where id",
        )
      )[0].h;
      await sql`update commercial_billing.control set environment='acceptance',sales_enabled=true,issuance_enabled=true,policy_version=${commercialPolicyVersion},approvals=${sql.json(
        {
          ...Object.fromEntries(
            [
              "owner",
              "legal",
              "googlePlay",
              "privacy",
              "retention",
              "refundRecovery",
              "playerRights",
              "supplyReconciliation",
            ].map((key) => [key, "ISOLATED FIXTURE ONLY"]),
          ),
          validUntil: "2099-01-01T00:00:00Z",
          withdrawals: false,
          prizes: false,
          paidEntry: false,
          nba: false,
        },
      )}`;
      await sql`update commercial_billing.products set approved=true`;
      for (let i = 0; i < 10; i++) {
        const player = randomUUID();
        for (const rarity of [
          "RARE",
          "ELITE",
          "ULTRA_RARE",
          "LEGENDARY",
          "ICON",
        ])
          await sql`insert into commercial_billing.definitions(player_id,sport,rarity,lifetime_cap,approved,rights_reference,snapshot) values(${player},'nfl',${rarity},${rarityRule(rarity).lifetimeCap!},true,'ISOLATED ONLY',${sql.json({ name: `Commercial ${i}`, team: "Fixture", position: "QB", season: "ISOLATED", verifiedJerseyNumber: null, colour: "#123456", status: "active", synthetic: true })})`;
      }
      const ledger = new CommercialLedger(sql, "acceptance", {
        active: "test",
        values: { test: randomBytes(32) },
      });
      const authorize = async () => {};
      const token = "isolated-preserved-collection",
        product = commercialProducts[0];
      await ledger.accept(
        {
          key: createHash("sha256")
            .update("docked.fantasy\0" + token)
            .digest("hex"),
          account: "a".repeat(64),
          environment: "acceptance",
          product,
          state: "PURCHASED",
          paid: true,
          consumed: false,
          orderId: "GPA.ISOLATED-COLLECTION",
          grossCents: product.audCents,
          taxCents: null,
          refundedCents: 0,
          providerAt: new Date().toISOString(),
        },
        d.user,
        token,
        authorize,
      );
      const p = commercialPack("nfl", "STANDARD", 9);
      const bought = await ledger.buyPack(
        d.user,
        randomUUID(),
        {
          sport: "nfl",
          family: "STANDARD",
          size: 9,
          configurationHash: p.configurationHash,
          confirmed: true,
        },
        authorize,
      );
      await ledger.openPack(d.user, bought.id, authorize);
      await sql`update commercial_billing.control set sales_enabled=false,issuance_enabled=false`;

      // Demonstrate the former omission against the exact same real database.
      const old = new CommercialMemberView(ledger, d.user, authorize);
      assert.equal((await old.collection({ sport: "nfl" })).total, 9);
      const current = new CommercialMemberView(ledger, d.user, authorize, true);
      await d.pg.exec("set role docked_commercial_app");
      const first = await current.collection({ sport: "nfl", sort: "name" });
      assert.equal(first.total, 31);
      assert.equal(first.cards.length, 18);
      assert(first.next);
      const second = await current.collection({
        sport: "nfl",
        sort: "name",
        cursor: first.next,
      });
      assert.equal(second.cards.length, 13);
      assert.equal(second.next, null);
      const all = [...first.cards, ...second.cards];
      assert.equal(new Set(all.map((c) => c.id)).size, 31);
      assert.equal(all.filter((c) => c.inventory === "beta").length, 22);
      assert(
        all
          .filter((c) => c.inventory === "beta")
          .every((c) => c.tradeable === false && c.season === "LIFETIME TEST"),
      );
      assert(
        !all.some((c) =>
          [legacyIds[22], legacyIds[23], legacyIds[24]].includes(c.id),
        ),
      );
      assert.equal(
        (
          await current.collection({
            sport: "nfl",
            search: "Preserved",
            team: "HOU",
          })
        ).filtered,
        22,
      );
      assert.equal((await current.collection({ sport: "afl" })).total, 0);
      assert.equal(
        (
          await new CommercialMemberView(
            ledger,
            d.other,
            authorize,
            true,
          ).collection({ sport: "nfl" })
        ).total,
        1,
      );
      await assert.rejects(
        current.collection({ sport: "basketball" }),
        /Sport unavailable/,
      );
      await assert.rejects(
        new CommercialMemberView(ledger, d.other, authorize, true).collection({
          sport: "nfl",
          sort: "name",
          cursor: first.next,
        }),
      );
      await d.pg.exec("reset role");
      assert.equal(
        (
          await d.q(
            "select md5(document::text) h from credits_sandbox.state where id",
          )
        )[0].h,
        before,
      );
      const record = (
        await d.q("select commercial_billing.member_record('nfl') r")
      )[0].r;
      assert.equal(record.total, 31);
      assert.equal(
        Object.values<number>(record.counts).reduce((n, count) => n + count, 0),
        31,
      );
      for (const role of [
        "anon",
        "authenticated",
        "service_role",
        "docked_app",
        "docked_beta_app",
      ])
        assert.equal(
          (
            await d.q(
              "select has_function_privilege($1,'commercial_billing.preserved_collection_rows(uuid,text)','execute') allowed",
              [role],
            )
          )[0].allowed,
          false,
        );
      // Custody moves in the historical ledger are reflected; an old cursor cannot
      // silently skip/duplicate cards. This test mutation never touches Production.
      state.commerce.cards[legacyIds[0]].owner = d.other;
      state.cards[legacyIds[0]].history.push({
        to: d.other,
        at: 1793877555000,
      });
      await d.pg.exec("alter table credits_sandbox.state disable trigger user");
      await d.q("update credits_sandbox.state set document=$1 where id", [
        state,
      ]);
      await d.pg.exec("alter table credits_sandbox.state enable trigger user");
      const stale = await current.collection({
        sport: "nfl",
        sort: "name",
        cursor: first.next,
      });
      assert.equal(stale.changed, true);
      assert.deepEqual(stale.cards, []);
      assert.equal((await current.collection({ sport: "nfl" })).total, 30);
      assert.equal(
        (
          await new CommercialMemberView(
            ledger,
            d.other,
            authorize,
            true,
          ).collection({ sport: "nfl" })
        ).total,
        2,
      );
    } finally {
      await d.pg.close();
    }
  },
);

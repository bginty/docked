import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID, randomBytes, createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import postgres, { type Sql } from "postgres";
import { multiSportDatabase } from "../fixtures/multi-sport-db";
import { CommercialMarketLedger } from "../../src/server/commercial-market-ledger";
import { CommercialMarketView } from "../../src/server/commercial-market-view";
import {
  commercialPack,
  commercialProducts,
  commercialPolicyVersion,
} from "../../src/core/commercial-billing";
import { rarityRule } from "../../src/core/card-rarity";
import { saleFeePolicy } from "../../src/core/credits-policy";
import { commercialMarketBrowser } from "../../scripts/commercial-market-browser";

test(
  "Commercial marketplace: native PostgreSQL races, reviewed terms, session/privacy gates, atomic receipts and emergency closure",
  { skip: !process.env.AUSTRALIAN_SALARY_TEST_DB },
  async (t) => {
    const d = await multiSportDatabase();
    let sql: Sql | undefined;
    try {
      assert(d.native);
      const native = d.native;
      await d.pg.exec(
        await readFile(
          "supabase/migrations/20261113003000_commercial_market_request_guards.sql",
          "utf8",
        ),
      );
      const url = new URL(process.env.AUSTRALIAN_SALARY_TEST_DB!);
      url.pathname =
        "/" + (await native`select current_database() name`)[0].name;
      sql = postgres(url.href, { max: 12, onnotice: () => {} });
      const third = randomUUID(),
        thirdSession = randomUUID();
      await native`insert into auth.users(id,email_confirmed_at) values(${third},now())`;
      await native`insert into auth.sessions(id,user_id) values(${thirdSession},${third})`;
      const members = [d.user, d.other, third],
        sessions = { ...d.sessions, [third]: thirdSession },
        profiles: Record<string, string> = {};
      const version = "isolated-commercial-market-v1";
      await native`insert into private.region_policies(country,state,version,effective_from,effective_to,review_at,approved,minimum_age,evidence) values('AU','NSW',${version},'2020-01-01','2100-01-01','2100-01-01',true,18,'ISOLATED FIXTURE ONLY')`;
      for (const [i, u] of members.entries()) {
        await native`update auth.users set phone=${"6140000000" + (i + 1)},phone_confirmed_at=now() where id=${u}`;
        await native`insert into public.profiles(id,country,state,age_attested,accepted_version)values(${u},'AU','NSW',true,${version})`;
        await native`insert into private.consent_events(user_id,purpose,granted,version,actor)values(${u},'privacy',true,${version},'isolated fixture')`;
        profiles[u] = (
          await native`insert into private.social_profiles(user_id,handle,display_name,visibility)values(${u},${"qa" + u.replaceAll("-", "").slice(0, 16)},'Synthetic member','members')returning id`
        )[0].id;
      }
      await native`update commercial_billing.control set environment='acceptance',sales_enabled=true,issuance_enabled=true,transfers_enabled=true,policy_version=${commercialPolicyVersion},approvals=${native.json({ ...Object.fromEntries(["owner", "legal", "googlePlay", "privacy", "retention", "refundRecovery", "playerRights", "supplyReconciliation"].map((k) => [k, "ISOLATED FIXTURE ONLY"])), validUntil: "2099-01-01T00:00:00Z", withdrawals: false, prizes: false, paidEntry: false, nba: false })}`;
      await native`update commercial_billing.products set approved=true`;
      for (let n = 0; n < 12; n++) {
        const player = randomUUID();
        for (const rarity of [
          "RARE",
          "ELITE",
          "ULTRA_RARE",
          "LEGENDARY",
          "ICON",
        ])
          await native`insert into commercial_billing.definitions(player_id,sport,rarity,lifetime_cap,approved,rights_reference,snapshot)values(${player},'nfl',${rarity},${rarityRule(rarity).lifetimeCap!},true,'ISOLATED FIXTURE ONLY',${native.json({ name: "Synthetic " + n, team: "TEST", position: "QB", season: "ISOLATED", verifiedJerseyNumber: null, colour: "#123456", status: "active", synthetic: true })})`;
      }
      const ledger = new CommercialMarketLedger(sql, "acceptance", {
        active: "local",
        values: { local: randomBytes(32) },
      });
      const access = (u: string, tradingEnabled = true) => ({
        tradingEnabled,
        actor: async (tx: Sql) => {
          await tx`set local role docked_commercial_app`;
          await tx`select set_config('request.jwt.claim.sub',${u},true),set_config('request.jwt.claims',${JSON.stringify({ sub: u, session_id: sessions[u], aal: "aal1" })},true)`;
        },
        party: async (tx: Sql, target: string) => {
          assert.equal(
            (
              await tx`select commercial_billing.market_party_allowed(${u}::uuid,${target}::uuid,${version},${version}) allowed`
            )[0].allowed,
            true,
            "Party eligibility denied",
          );
        },
      });
      const command = (
        u: string,
        c: Record<string, unknown>,
        request = randomUUID(),
        enabled = true,
      ) => ledger.command(u, { request, command: c }, access(u, enabled));
      const view = (u: string) =>
        new CommercialMarketView(
          ledger,
          u,
          access(u).actor,
          { terms: version, privacy: version },
          true,
        );
      for (const u of members) {
        const token = "isolated-market-" + u,
          p = commercialProducts[0];
        await ledger.accept(
          {
            key: createHash("sha256")
              .update("docked.fantasy\0" + token)
              .digest("hex"),
            account: "a".repeat(64),
            environment: "acceptance",
            product: p,
            state: "PURCHASED",
            paid: true,
            consumed: false,
            orderId: "GPA.ISOLATED." + u,
            grossCents: p.audCents,
            taxCents: null,
            refundedCents: 0,
            providerAt: new Date().toISOString(),
          },
          u,
          token,
          async () => {},
        );
      }
      const offer = commercialPack("nfl", "STANDARD", 9),
        pack = await ledger.buyPack(
          d.user,
          randomUUID(),
          {
            sport: "nfl",
            family: "STANDARD",
            size: 9,
            configurationHash: offer.configurationHash,
            confirmed: true,
          },
          async () => {},
        );
      const opened = await ledger.openPack(d.user, pack.id, async () => {});
      assert.equal(opened.cards.length, 9);
      const request = randomUUID(),
        list = {
          kind: "list",
          card: opened.cards[0].id,
          price: 1000,
          preference: "sell",
        };
      const results = await Promise.all(
        Array.from({ length: 20 }, () => command(d.user, list, request)),
      );
      assert(results.every((r) => r.listing === results[0].listing));
      const listing = results[0].listing;
      assert.equal(
        (
          await native`select count(*)::int n from commercial_billing.audit where action='market-request' and reference=${"market:" + request}`
        )[0].n,
        1,
      );
      await assert.rejects(
        command(d.user, { ...list, price: 2000 }, request),
        /different listing details/,
      );
      await assert.rejects(
        command(d.other, { kind: "cancel-listing", listing }),
        /Only the seller/,
      );
      await assert.rejects(
        command(d.other, {
          kind: "reprice-listing",
          listing,
          price: 1,
          expectedRevision: 1,
        }),
        /Only the seller/,
      );
      await assert.rejects(
        command(d.user, { kind: "review-buy", listing }),
        /no longer available/,
      );
      const stale = await command(d.other, { kind: "review-buy", listing });
      await command(d.user, {
        kind: "reprice-listing",
        listing,
        price: 1100,
        expectedRevision: 1,
      });
      const buy = (review: any) => ({
        kind: "buy",
        listing,
        review: review.review,
        expectedPrice: review.price,
        policy: review.policy,
        confirmed: true,
      });
      await assert.rejects(command(d.other, buy(stale)), /changed or expired/);
      assert.equal((await ledger.wallet(d.other)).balance, 4900);
      await native`insert into private.social_blocks(actor_id,target_id) values(${profiles[d.user]},${profiles[d.other]})`;
      assert.equal((await view(d.other).read({ sport: "nfl" })).total, 0);
      await assert.rejects(
        command(d.other, { kind: "review-buy", listing }),
        /Party eligibility/,
      );
      await native`delete from private.social_blocks where actor_id=${profiles[d.user]}`;
      await native`update auth.users set phone_confirmed_at=null where id=${d.user}`;
      await assert.rejects(
        command(d.other, { kind: "review-buy", listing }),
        /Party eligibility/,
      );
      await native`update auth.users set phone_confirmed_at=now() where id=${d.user}`;
      const timedReview = await command(d.other, {
        kind: "review-buy",
        listing,
      });
      try {
        t.mock.timers.enable({ apis: ["Date"], now: timedReview.expires });
        await assert.rejects(
          command(d.other, buy(timedReview)),
          /changed or expired/,
        );
      } finally {
        t.mock.timers.reset();
      }
      await assert.rejects(
        command(third, buy(timedReview)),
        /changed or expired/,
      );
      assert.equal((await ledger.wallet(d.other)).balance, 4900);
      const reviews = await Promise.all([
        command(d.other, { kind: "review-buy", listing }),
        command(third, { kind: "review-buy", listing }),
      ]);
      assert(
        reviews.every(
          (r) => r.policy === saleFeePolicy && r.fee === 55 && r.net === 1045,
        ),
      );
      const requests = [randomUUID(), randomUUID()];
      const race = await Promise.allSettled([
        command(d.other, buy(reviews[0]), requests[0]),
        command(third, buy(reviews[1]), requests[1]),
      ]);
      assert.equal(race.filter((r) => r.status === "fulfilled").length, 1);
      const winner = race[0].status === "fulfilled" ? 0 : 1,
        buyer = winner === 0 ? d.other : third;
      const result = (race[winner] as PromiseFulfilledResult<any>).value;
      assert.equal(result.receipt.cardSnapshot.id, opened.cards[0].id);
      assert.equal(result.receipt.price, 1100);
      assert.equal((await ledger.wallet(buyer)).balance, 3800);
      assert.equal((await ledger.wallet(d.user)).balance, 5245);
      assert.equal(
        (
          await native`select owner_id from commercial_billing.cards where id=${opened.cards[0].id}`
        )[0].owner_id,
        buyer,
      );
      assert.equal(
        (
          await native`select count(*)::int n from commercial_billing.ownership_events where reference=${"sale:" + listing}`
        )[0].n,
        1,
      );
      assert.equal(
        (await view(buyer).read({ sport: "nfl", tab: "activity" })).activity[0]
          .reference,
        "sale:" + listing,
      );
      const outsider = buyer === d.other ? third : d.other;
      assert.equal(
        (
          await view(outsider).read({
            sport: "nfl",
            tab: "activity",
            sale: listing,
          })
        ).activity.length,
        0,
      );
      await assert.rejects(
        native`update commercial_billing.listings set price=1 where id=${listing}`,
        /history immutable/,
      );
      const second = await command(d.user, {
        ...list,
        card: opened.cards[1].id,
      });
      // A member-bound cursor must never survive listing repricing, nor be
      // accepted for a different account or activity filter.
      const extraListing = await command(d.user, {
        ...list,
        card: opened.cards[3].id,
        price: 2000,
      });
      const pageQuery = { sport: "nfl", tab: "listings", limit: 1 };
      const pageOne = await view(d.user).read(pageQuery);
      assert(pageOne.next);
      const pageTwo = await view(d.user).read({
        ...pageQuery,
        cursor: pageOne.next,
      });
      assert.equal(pageTwo.rows.length, 1);
      assert.notEqual(pageTwo.rows[0].id, pageOne.rows[0].id);
      await assert.rejects(
        view(d.other).read({ ...pageQuery, cursor: pageOne.next }),
      );
      await command(d.user, {
        kind: "reprice-listing",
        listing: extraListing.listing,
        price: 2100,
        expectedRevision: 1,
      });
      await assert.rejects(
        view(d.user).read({ ...pageQuery, cursor: pageOne.next }),
        /refresh the first page/,
      );
      assert.equal(
        (
          await view(d.user).read({
            sport: "nfl",
            sell: opened.cards[1].id,
            tab: "listings",
          })
        ).inventory[0].listingId,
        second.listing,
      );
      assert.equal(
        (
          await view(d.other).read({
            sport: "nfl",
            sell: opened.cards[1].id,
            tab: "listings",
          })
        ).inventory.length,
        0,
      );
      await native`update commercial_billing.control set transfers_enabled=false`;
      assert.deepEqual(
        await command(buyer, buy(reviews[winner]), requests[winner], false),
        result,
      );
      await assert.rejects(
        command(
          d.user,
          { ...list, card: opened.cards[2].id },
          randomUUID(),
          false,
        ),
        /temporarily unavailable/,
      );
      const cancelled = await command(
        d.user,
        {
          kind: "cancel-listing",
          listing: second.listing,
          expectedRevision: 1,
        },
        randomUUID(),
        false,
      );
      assert.equal(cancelled.status, "CANCELLED");
      assert.equal(
        (
          await view(d.user).read({
            sport: "nfl",
            tab: "activity",
            activityType: "cancellation",
          })
        ).activity.length,
        1,
      );
      const [accounting] =
        await native`select count(*)::int n from(select journal from commercial_billing.lines group by journal having sum(amount)<>0)x`;
      assert.equal(accounting.n, 0);
      await assert.rejects(
        native`update commercial_billing.audit set details='{}' where action='market-request'`,
        /immutable/i,
      );
      const [grants] =
        await native`select has_function_privilege('authenticated','commercial_billing.market_party_allowed(uuid,uuid,text,text)','execute') allowed`;
      assert.equal(grants.allowed, false);
      assert.equal(
        (await native`select count(*)::int n from commercial_billing.cards`)[0]
          .n,
        9,
      );
      if (process.env.DOCKED_MARKET_BROWSER === "true") {
        await native`update commercial_billing.control set transfers_enabled=true`;
        const browserListing = await command(d.user, {
          ...list,
          card: opened.cards[2].id,
        });
        await commercialMarketBrowser(
          ledger,
          d.user,
          outsider,
          access,
          version,
          browserListing.listing,
        );
      }
      await native`update auth.sessions set not_after=now()-interval '1 second' where id=${sessions[d.user]}`;
      await sql.begin(async (raw) => {
        const tx = raw as unknown as Sql;
        await access(d.user).actor(tx);
        await assert.rejects(
          access(d.user).party(tx, d.user),
          /Party eligibility/,
        );
      });
    } finally {
      await sql?.end();
      await d.pg.close();
    }
  },
);

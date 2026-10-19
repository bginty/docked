import { test } from "node:test";
import assert from "node:assert/strict";
import {
  executeCredits,
  wallet,
  validateCredits,
  financialReport,
} from "../../src/core/credits-sandbox";
import { sellerQuote, saleFeePolicy } from "../../src/core/credits-policy";
import {
  marketplaceFixture,
  marketActors,
  marketLabels,
} from "../fixtures/marketplace-state";
import { marketplaceView, marketQuery } from "../../src/core/marketplace";
const now = Date.now();
test("approved whole-credit rounding, no minimum and cap", () => {
  for (const [price, fee, net] of [
    [1, 0, 1],
    [10, 1, 9],
    [1000, 50, 950],
    [40000, 2000, 38000],
    [100000, 2000, 98000],
  ])
    assert.deepEqual(sellerQuote(price), {
      price,
      fee,
      net,
      policy: saleFeePolicy,
    });
  for (const p of [0, -1, 1.1, NaN, Infinity, 1000000001])
    assert.throws(() => sellerQuote(p));
});
test("two members: shared feed, in-place versioned price, cancel/relist, sale journal, ownership, snapshots and replay", () => {
  let s = marketplaceFixture(now),
    seq = 0;
  const run = (i: number, c: unknown, id = `request${++seq}`) => {
    const out = executeCredits(s, marketActors[i], id, c, now);
    s = out.state;
    return out.result as any;
  };
  const card = Object.keys(s.cards).find(
    (id) => s.commerce.cards[id].owner === marketActors[0].id,
  )!;
  const view = (i: number, tab = "browse") =>
    marketplaceView(
      s,
      marketActors[i].id,
      marketLabels,
      marketQuery.parse({ tab }),
      { reserved: [], rounds: [] },
      now,
    );
  const before = s.journal.length,
    balances = marketActors.map((a) => wallet(s, a.id).spendable);
  run(0, { kind: "list", card, price: 1000, preference: "sell" }, "listing1");
  assert.equal(view(0, "listings").rows.length, 1);
  assert.equal(view(0, "listings").inventory.length, 0);
  assert.equal(view(1).rows.length, 1);
  assert.equal(view(1).rows[0].seller, marketLabels[0].label);
  assert.throws(
    () => run(0, { kind: "list", card, price: 1000 }),
    /Already listed/,
  );
  const stale = run(
    1,
    { kind: "review-buy", listing: "listing1" },
    "oldreview",
  );
  assert.throws(
    () =>
      run(1, {
        kind: "reprice-listing",
        listing: "listing1",
        price: 1200,
        expectedRevision: 1,
      }),
    /Account isolation|owner|Ownership|own/i,
  );
  run(0, {
    kind: "reprice-listing",
    listing: "listing1",
    price: 1200,
    expectedRevision: 1,
  });
  assert.equal(view(1).rows[0].price, 1200);
  assert.equal(Object.keys(s.listings).length, 1);
  assert.throws(
    () =>
      run(0, {
        kind: "reprice-listing",
        listing: "listing1",
        price: 1300,
        expectedRevision: 1,
      }),
    /changed/,
  );
  assert.throws(
    () =>
      run(1, {
        kind: "buy",
        listing: "listing1",
        review: stale.review,
        expectedPrice: 1000,
        policy: s.policy.version,
        confirmed: true,
      }),
    /stale|changed/,
  );
  run(0, { kind: "cancel-listing", listing: "listing1", expectedRevision: 2 });
  assert.equal(view(1).rows.length, 0);
  assert.equal(view(0, "listings").rows.length, 0);
  assert.equal(view(0, "activity").activity.length, 0);
  run(0, { kind: "list", card, price: 1000, preference: "sell" }, "listing2");
  const review = run(1, { kind: "review-buy", listing: "listing2" }, "review2");
  const command = {
    kind: "buy",
    listing: "listing2",
    review: review.review,
    expectedPrice: 1000,
    policy: s.policy.version,
    confirmed: true,
  };
  const result = run(1, command, "purchase");
  assert.deepEqual(run(1, command, "purchase"), result);
  assert.equal(s.journal.length, before + 1);
  assert.equal(wallet(s, marketActors[0].id).spendable, balances[0] + 950);
  assert.equal(wallet(s, marketActors[1].id).spendable, balances[1] - 1000);
  assert.equal(financialReport(s).commission, 50);
  assert.equal(s.commerce.cards[card].owner, marketActors[1].id);
  assert.equal(s.listings.listing2.receipt?.feePolicy, saleFeePolicy);
  const name = s.listings.listing2.receipt!.cardSnapshot!.name;
  s.economy!.players[s.economy!.instances[card].playerId].name =
    "Changed current name";
  assert.equal(view(0, "activity").activity[0].card.name, name);
  assert.equal(view(1, "activity").activity[0].kind, "purchase");
  assert.equal(view(2, "activity").activity.length, 0);
  assert.throws(
    () =>
      run(0, {
        kind: "cancel-listing",
        listing: "listing2",
        expectedRevision: 1,
      }),
    /sold/,
  );
  assert.throws(() => run(2, { ...command, review: undefined }), /sold/);
  validateCredits(s);
});

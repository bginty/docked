import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import {
  marketplaceFixture,
  marketActors,
} from "../fixtures/marketplace-state";
import {
  executeCredits,
  wallet,
  validateCredits,
} from "../../src/core/credits-sandbox";
import {
  executePrivateOffer,
  type OfferPermission,
} from "../../src/core/private-card-offers";
import { marketplaceView, marketQuery } from "../../src/core/marketplace";
import {
  memberTestView,
  memberTestCommand,
} from "../../src/core/member-test-wallet";

const now = 1792065600000;
const permission: OfferPermission = {
  allowed: true,
  minimum: null,
  swaps: true,
  combinedPolicy: "credit-commission-floor-v1",
};
function setup(mode: "sell" | "swap" | "both" = "both") {
  let state = marketplaceFixture(now);
  const seller = marketActors[0],
    buyer = marketActors[1];
  const card = Object.keys(state.cards).find(
    (id) => state.commerce.cards[id].owner === seller.id,
  )!;
  const give = Object.keys(state.cards).find(
    (id) => state.commerce.cards[id].owner === buyer.id,
  )!;
  const listing = randomUUID();
  state = executeCredits(
    state,
    seller,
    listing,
    { kind: "list", card, price: mode === "swap" ? 0 : 1000, preference: mode },
    now,
  ).state;
  return { state, seller, buyer, card, give, listing };
}
test("seller lists sale, swap or both without choosing a counterparty", () => {
  for (const mode of ["sell", "swap", "both"] as const) {
    const f = setup(mode);
    assert.equal(f.state.listings[f.listing].preference, mode);
    assert.equal(f.state.commerce.cards[f.card].owner, f.seller.id);
    if (mode === "swap")
      assert.throws(
        () =>
          executeCredits(
            f.state,
            f.buyer,
            randomUUID(),
            { kind: "review-buy", listing: f.listing },
            now,
          ),
        /swap offers only/,
      );
  }
});
test("credit, card and combined offers settle exact assets once using existing wallet", () => {
  for (const structure of ["credit", "card", "combined"]) {
    const f = setup(),
      id = randomUUID(),
      acceptance = randomUUID();
    const price = structure === "card" ? 0 : 1000;
    const hasCard = structure !== "credit";
    const beforeBuyer = wallet(f.state, f.buyer.id).spendable,
      beforeSeller = wallet(f.state, f.seller.id).spendable;
    const snapshot = structuredClone(f.state.economy!.instances);
    const proposed = executePrivateOffer(
      f.state,
      f.buyer,
      id,
      {
        kind: "private-offer",
        card: f.card,
        listing: f.listing,
        price,
        ...(hasCard ? { offeredCards: [f.give] } : {}),
      },
      now,
      permission,
    );
    assert.equal(wallet(proposed.state, f.buyer.id).spendable, beforeBuyer);
    const accepted = executePrivateOffer(
      proposed.state,
      f.seller,
      acceptance,
      { kind: "private-accept", offer: id },
      now + 1,
      permission,
    );
    validateCredits(accepted.state);
    assert.equal(accepted.state.commerce.cards[f.card].owner, f.buyer.id);
    if (hasCard)
      assert.equal(accepted.state.commerce.cards[f.give].owner, f.seller.id);
    const feeEach = proposed.state.privateCardOffers![id].feeEach ?? 0;
    assert.equal(
      wallet(accepted.state, f.buyer.id).spendable,
      beforeBuyer - price - feeEach,
    );
    assert.equal(
      wallet(accepted.state, f.seller.id).spendable,
      beforeSeller + (price ? 925 : 0) - feeEach,
    );
    assert.deepEqual(accepted.state.economy!.instances, snapshot);
    const retry = executePrivateOffer(
      accepted.state,
      f.seller,
      acceptance,
      { kind: "private-accept", offer: id },
      now + 2,
      permission,
    );
    assert.deepEqual(retry.state, accepted.state);
    assert.throws(
      () =>
        executePrivateOffer(
          accepted.state,
          f.seller,
          randomUUID(),
          { kind: "private-accept", offer: id },
          now + 2,
          permission,
        ),
      /accepted/,
    );
  }
});
test("changing listing terms invalidates pending offers and retains original terms", () => {
  const f = setup(),
    id = randomUUID();
  let s = executePrivateOffer(
    f.state,
    f.buyer,
    id,
    { kind: "private-offer", card: f.card, listing: f.listing, price: 1000 },
    now,
    permission,
  ).state;
  s = executeCredits(
    s,
    f.seller,
    randomUUID(),
    {
      kind: "replace-listing",
      listing: f.listing,
      card: f.card,
      price: 2000,
      preference: "both",
    },
    now + 1,
  ).state;
  assert.equal(s.listings[f.listing].price, 1000);
  assert.equal(s.listings[f.listing].status, "CANCELLED");
  assert.throws(
    () =>
      executePrivateOffer(
        s,
        f.seller,
        randomUUID(),
        { kind: "private-accept", offer: id },
        now + 2,
        permission,
      ),
    /Listing changed/,
  );
});
test("failed acceptance never mutates input or partially transfers", () => {
  for (const reason of [
    "owner",
    "lock",
    "funds",
    "blocked",
    "minimum",
    "policy",
  ]) {
    const f = setup(),
      id = randomUUID();
    const s = executePrivateOffer(
      f.state,
      f.buyer,
      id,
      {
        kind: "private-offer",
        card: f.card,
        price: 1000,
        offeredCards: [f.give],
      },
      now,
      permission,
    ).state;
    if (reason === "owner") {
      s.commerce.cards[f.give].owner = marketActors[2].id;
      s.cards[f.give].version++;
    }
    if (reason === "lock") s.cards[f.give].locked = true;
    if (reason === "funds") s.privateCardOffers![id].price = 1000000000;
    const p = {
      ...permission,
      ...(reason === "blocked" ? { allowed: false } : {}),
      ...(reason === "minimum" ? { minimum: 1001 } : {}),
      ...(reason === "policy" ? { combinedPolicy: undefined } : {}),
    };
    const before = structuredClone(s);
    assert.throws(() =>
      executePrivateOffer(
        s,
        f.seller,
        randomUUID(),
        { kind: "private-accept", offer: id },
        now + 1,
        p,
      ),
    );
    assert.deepEqual(s, before);
  }
});
test("two offers cannot transfer the same requested card twice", () => {
  const f = setup(),
    ids = [randomUUID(), randomUUID()];
  let s = f.state;
  for (const [i, id] of ids.entries())
    s = executePrivateOffer(
      s,
      marketActors[i + 1],
      id,
      { kind: "private-offer", card: f.card, price: 1000 },
      now,
      permission,
    ).state;
  s = executePrivateOffer(
    s,
    f.seller,
    randomUUID(),
    { kind: "private-accept", offer: ids[0] },
    now + 1,
    permission,
  ).state;
  assert.throws(
    () =>
      executePrivateOffer(
        s,
        f.seller,
        randomUUID(),
        { kind: "private-accept", offer: ids[1] },
        now + 2,
        permission,
      ),
    /ownership changed|Listing changed/,
  );
});
test("no invented valuation, multiple cards or combined fee default", () => {
  const f = setup();
  assert.throws(
    () =>
      executePrivateOffer(
        f.state,
        f.buyer,
        randomUUID(),
        {
          kind: "private-offer",
          card: f.card,
          price: 0,
          offeredCards: [f.give],
        },
        now,
        { ...permission, minimum: 1 },
      ),
    /preferences/,
  );
  assert.throws(
    () =>
      executePrivateOffer(
        f.state,
        f.buyer,
        randomUUID(),
        {
          kind: "private-offer",
          card: f.card,
          price: 1000,
          offeredCards: [f.give],
        },
        now,
        { ...permission, combinedPolicy: undefined },
      ),
    /fee-policy approval/,
  );
  assert.throws(() =>
    executePrivateOffer(
      f.state,
      f.buyer,
      randomUUID(),
      {
        kind: "private-offer",
        card: f.card,
        price: 0,
        offeredCards: [f.give, f.give],
      },
      now,
      permission,
    ),
  );
  assert.throws(
    () =>
      memberTestCommand({
        kind: "offer",
        other: f.seller.id,
        give: [f.give],
        take: [f.card],
        feeEach: 0,
        creditTopUp: 1000,
      }),
    /reviewed private-offer/,
  );
});
test("hidden listings absent from browse and alternate wallet projections; owner retains access", () => {
  const f = setup();
  const view = marketplaceView(f.state, f.buyer.id, [], marketQuery.parse({}), {
    reserved: [],
    rounds: [],
    hiddenCards: [f.card],
  });
  assert.equal(view.total, 0);
  const alternate = memberTestView(f.state, f.buyer.id, [], false, now, [
    f.card,
  ]);
  assert.ok(!alternate.cards.some((c) => c.id === f.card));
  assert.ok(!alternate.listings.some((l) => l.card === f.card));
  assert.ok(
    memberTestView(f.state, f.seller.id, [], false, now, [f.card]).cards.some(
      (c) => c.id === f.card,
    ),
  );
});

import { combinedOfferQuote } from "../../src/core/credits-policy";
test("combined fee is exactly higher of 7.5 percent credits and current swap floor", () => {
  assert.deepEqual(
    [50, 100, 666, 667, 1000].map((p) => combinedOfferQuote(p, 50).fee),
    [50, 50, 50, 50, 75],
  );
  assert.equal(combinedOfferQuote(100, 50).net, 50);
  assert.equal(combinedOfferQuote(100, 0).fee, 8);
  assert.throws(() => combinedOfferQuote(49, 50), /at least 50/);
  assert.throws(() => combinedOfferQuote(1, -1));
});

test("one offered card cannot settle twice against two different sellers", () => {
  const f = setup(),
    second = marketActors[2],
    ids = [randomUUID(), randomUUID()];
  const otherCard = Object.keys(f.state.cards).find(
    (id) => f.state.commerce.cards[id].owner === second.id,
  )!;
  let s = f.state;
  for (const [i, card] of [f.card, otherCard].entries())
    s = executePrivateOffer(
      s,
      f.buyer,
      ids[i],
      { kind: "private-offer", card, offeredCards: [f.give], price: 1000 },
      now,
      permission,
    ).state;
  s = executePrivateOffer(
    s,
    f.seller,
    randomUUID(),
    { kind: "private-accept", offer: ids[0] },
    now + 1,
    permission,
  ).state;
  const before = structuredClone(s);
  assert.throws(
    () =>
      executePrivateOffer(
        s,
        second,
        randomUUID(),
        { kind: "private-accept", offer: ids[1] },
        now + 2,
        permission,
      ),
    /ownership changed/,
  );
  assert.deepEqual(s, before);
});
test("listing cancellation and acceptance cannot both win", () => {
  for (const cancelFirst of [true, false]) {
    const f = setup(),
      id = randomUUID();
    let s = executePrivateOffer(
      f.state,
      f.buyer,
      id,
      {
        kind: "private-offer",
        card: f.card,
        listing: f.listing,
        offeredCards: [f.give],
        price: 1000,
      },
      now,
      permission,
    ).state;
    if (cancelFirst) {
      s = executeCredits(
        s,
        f.seller,
        randomUUID(),
        { kind: "cancel-listing", listing: f.listing },
        now + 1,
      ).state;
      assert.throws(
        () =>
          executePrivateOffer(
            s,
            f.seller,
            randomUUID(),
            { kind: "private-accept", offer: id },
            now + 2,
            permission,
          ),
        /Listing changed/,
      );
    } else {
      s = executePrivateOffer(
        s,
        f.seller,
        randomUUID(),
        { kind: "private-accept", offer: id },
        now + 1,
        permission,
      ).state;
      const after = executeCredits(
        s,
        f.seller,
        randomUUID(),
        { kind: "cancel-listing", listing: f.listing },
        now + 2,
      ).state;
      // Swap acceptance already closes the listing. A subsequent cancellation is a safe no-op.
      assert.equal(after.privateCardOffers![id].status, "ACCEPTED");
      assert.deepEqual(after.commerce, s.commerce);
      assert.deepEqual(after.journal, s.journal);
      assert.deepEqual(after.cards, s.cards);
    }
    validateCredits(s);
  }
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import {
  marketplaceFixture,
  marketActors,
  marketLabels,
} from "../fixtures/marketplace-state";
import {
  executePrivateOffer,
  privateOfferEnabled,
  effectiveOfferStatus,
} from "../../src/core/private-card-offers";
import {
  executeCredits,
  wallet,
  validateCredits,
  financialReport,
} from "../../src/core/credits-sandbox";
import { marketplaceView, marketQuery } from "../../src/core/marketplace";
import { collectionAllowed, hubAction } from "../../src/core/social-hub";
const now = 1792065600000,
  permission = { allowed: true, minimum: null };
function fixture() {
  const s = marketplaceFixture(now);
  return {
    s,
    card: Object.keys(s.cards).find(
      (id) => s.commerce.cards[id].owner === marketActors[0].id,
    )!,
  };
}
test("collections default private and followers never bypass profile blocking", () => {
  assert.equal(collectionAllowed("private", false, true, true), false);
  assert.equal(collectionAllowed("followers", false, true, true), true);
  assert.equal(collectionAllowed("members", false, true, false), false);
  assert.equal(collectionAllowed("private", true, false, true), true);
  assert.equal(
    hubAction.safeParse({
      action: "collection_preferences",
      visibility: "members",
      offers: "everyone",
      minimum: 0,
      cards: {},
    }).success,
    false,
  );
});
test("private offer activation cannot reach hosting, production, or non-loopback databases", () => {
  const env = {
    DOCKED_PRIVATE_OFFERS_LOCAL: "true",
    NODE_ENV: "development",
    DATABASE_URL: "postgres://qa@127.0.0.1:55322/postgres",
  };
  assert.equal(privateOfferEnabled(env), true);
  for (const extra of [
    { VERCEL: "1" },
    { NODE_ENV: "production" },
    { DATABASE_URL: "postgres://qa@hosted.example/db" },
    { DOCKED_PRIVATE_OFFERS_LOCAL: "false" },
  ])
    assert.equal(privateOfferEnabled({ ...env, ...extra }), false);
});
test("acceptance uses existing ledger, current fee calculation (legacy core only; HTTP acceptance disabled), permanent identity and one replayed settlement", () => {
  for (const price of [100, 1000]) {
    const initial = fixture();
    let s = initial.s;
    const card = initial.card;
    const buyer = marketActors[1],
      seller = marketActors[0],
      create = randomUUID(),
      accept = randomUUID();
    const beforeBuyer = wallet(s, buyer.id).spendable,
      beforeSeller = wallet(s, seller.id).spendable,
      serial = structuredClone(s.economy!.instances[card]),
      issued = financialReport(s).circulation.issued;
    const first = executePrivateOffer(
      s,
      buyer,
      create,
      { kind: "private-offer", card, price },
      now,
      permission,
    );
    s = first.state;
    assert.equal(
      wallet(s, buyer.id).spendable,
      beforeBuyer,
      "No seven-day hold",
    );
    assert.deepEqual(
      executePrivateOffer(
        s,
        buyer,
        create,
        { kind: "private-offer", card, price },
        now,
        permission,
      ).result,
      first.result,
    );
    const settled = executePrivateOffer(
      s,
      seller,
      accept,
      { kind: "private-accept", offer: create },
      now + 1,
      permission,
    );
    s = settled.state;
    assert.equal(wallet(s, buyer.id).spendable, beforeBuyer - price);
    assert.equal(
      wallet(s, seller.id).spendable,
      beforeSeller + price - (price === 100 ? 5 : 50),
    );
    assert.equal(s.commerce.cards[card].owner, buyer.id);
    assert.deepEqual(s.economy!.instances[card], serial);
    const retry = executePrivateOffer(
      s,
      seller,
      accept,
      { kind: "private-accept", offer: create },
      now + 2,
      permission,
    );
    assert.deepEqual(retry.state, s);
    assert.deepEqual(retry.result, settled.result);
    assert.equal(financialReport(s).circulation.issued, issued);
    validateCredits(s);
    const listing = s.privateCardOffers![create].listing!;
    const other = marketplaceView(
      s,
      marketActors[2].id,
      marketLabels,
      marketQuery.parse({ listing }),
      undefined,
      now + 2,
    );
    assert.equal(
      other.rows.length,
      0,
      "Private offer sale inaccessible to a third member",
    );
  }
});
test("two distinct buyers: only one private offer can settle; competing public purchase makes acceptance stale", () => {
  let { s, card } = fixture();
  const a = randomUUID(),
    b = randomUUID();
  s = executePrivateOffer(
    s,
    marketActors[1],
    a,
    { kind: "private-offer", card, price: 100 },
    now,
    permission,
  ).state;
  s = executePrivateOffer(
    s,
    marketActors[2],
    b,
    { kind: "private-offer", card, price: 101 },
    now,
    permission,
  ).state;
  s = executePrivateOffer(
    s,
    marketActors[0],
    randomUUID(),
    { kind: "private-accept", offer: a },
    now + 1,
    permission,
  ).state;
  assert.throws(
    () =>
      executePrivateOffer(
        s,
        marketActors[0],
        randomUUID(),
        { kind: "private-accept", offer: b },
        now + 2,
        permission,
      ),
    /ownership changed/,
  );
  ({ s, card } = fixture());
  const offer = randomUUID();
  s = executePrivateOffer(
    s,
    marketActors[1],
    offer,
    { kind: "private-offer", card, price: 100 },
    now,
    permission,
  ).state;
  s = executeCredits(
    s,
    marketActors[0],
    "public-sale",
    { kind: "list", card, price: 200 },
    now,
  ).state;
  s = executeCredits(
    s,
    marketActors[2],
    "public-purchase",
    {
      kind: "buy",
      listing: "public-sale",
      expectedPrice: 200,
      policy: s.policy.version,
      confirmed: true,
    },
    now,
  ).state;
  assert.throws(
    () =>
      executePrivateOffer(
        s,
        marketActors[0],
        randomUUID(),
        { kind: "private-accept", offer },
        now + 1,
        permission,
      ),
    /ownership changed/,
  );
});
test("decline cooldown, one active offer, expiry boundary and daily limits are deterministic", () => {
  const initial = fixture();
  let s = initial.s;
  const card = initial.card;
  const id = randomUUID();
  s = executePrivateOffer(
    s,
    marketActors[1],
    id,
    { kind: "private-offer", card, price: 100 },
    now,
    permission,
  ).state;
  assert.throws(
    () =>
      executePrivateOffer(
        s,
        marketActors[1],
        randomUUID(),
        { kind: "private-offer", card, price: 100 },
        now,
        permission,
      ),
    /active offer/,
  );
  assert.equal(
    effectiveOfferStatus(s.privateCardOffers![id], now + 7 * 86400000),
    "EXPIRED",
  );
  assert.throws(
    () =>
      executePrivateOffer(
        s,
        marketActors[0],
        randomUUID(),
        { kind: "private-accept", offer: id },
        now + 7 * 86400000,
        permission,
      ),
    /expired/,
  );
  s = executePrivateOffer(
    s,
    marketActors[0],
    randomUUID(),
    { kind: "private-decline", offer: id },
    now + 1,
    permission,
  ).state;
  assert.throws(
    () =>
      executePrivateOffer(
        s,
        marketActors[1],
        randomUUID(),
        { kind: "private-offer", card, price: 100 },
        now + 2,
        permission,
      ),
    /24 hours/,
  );
  for (let i = 0; i < 2; i++) {
    const offer = randomUUID();
    s = executePrivateOffer(
      s,
      marketActors[2],
      offer,
      { kind: "private-offer", card, price: 100 },
      now,
      permission,
    ).state;
    s = executePrivateOffer(
      s,
      marketActors[2],
      randomUUID(),
      { kind: "private-cancel", offer },
      now,
      permission,
    ).state;
  }
  const third = randomUUID();
  s = executePrivateOffer(
    s,
    marketActors[2],
    third,
    { kind: "private-offer", card, price: 100 },
    now,
    permission,
  ).state;
  s = executePrivateOffer(
    s,
    marketActors[2],
    randomUUID(),
    { kind: "private-cancel", offer: third },
    now,
    permission,
  ).state;
  assert.throws(
    () =>
      executePrivateOffer(
        s,
        marketActors[2],
        randomUUID(),
        { kind: "private-offer", card, price: 100 },
        now,
        permission,
      ),
    /limit/,
  );
});
test("blocked permissions, locks, insufficient funds, private minima and cross-account actions cannot settle", () => {
  const initial = fixture();
  let s = initial.s;
  const card = initial.card;
  const offer = randomUUID();
  assert.throws(
    () =>
      executePrivateOffer(
        s,
        marketActors[1],
        offer,
        { kind: "private-offer", card, price: 100 },
        now,
        { allowed: false, minimum: null },
      ),
    /accepting offers/,
  );
  assert.throws(
    () =>
      executePrivateOffer(
        s,
        marketActors[1],
        offer,
        { kind: "private-offer", card, price: 100 },
        now,
        { allowed: true, minimum: 500 },
      ),
    /preferences/,
  );
  s = executePrivateOffer(
    s,
    marketActors[1],
    offer,
    { kind: "private-offer", card, price: 100 },
    now,
    permission,
  ).state;
  assert.throws(
    () =>
      executePrivateOffer(
        s,
        marketActors[2],
        randomUUID(),
        { kind: "private-accept", offer },
        now,
        permission,
      ),
    /unavailable/,
  );
  s.cards[card].locked = true;
  const before = structuredClone(s);
  assert.throws(
    () =>
      executePrivateOffer(
        s,
        marketActors[0],
        randomUUID(),
        { kind: "private-accept", offer },
        now,
        permission,
      ),
    /locked/,
  );
  assert.deepEqual(s, before);
  s.cards[card].locked = false;
  assert.throws(
    () =>
      executePrivateOffer(
        s,
        marketActors[0],
        randomUUID(),
        { kind: "private-accept", offer },
        now,
        { allowed: false, minimum: null },
      ),
    /permissions/,
  );
  assert.throws(
    () =>
      executePrivateOffer(
        s,
        marketActors[2],
        randomUUID(),
        { kind: "private-offer", card, price: 1000000000 },
        now,
        permission,
      ),
    /Insufficient/,
  );
});

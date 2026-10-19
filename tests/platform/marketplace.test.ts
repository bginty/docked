import { test } from "node:test";
import assert from "node:assert/strict";
import {
  executeCredits,
  wallet,
  financialReport,
  validateCredits,
} from "../../src/core/credits-sandbox";
import { marketplaceView, marketQuery } from "../../src/core/marketplace";
import {
  memberTestCommand,
  memberTestView,
} from "../../src/core/member-test-wallet";
import { sellerQuote } from "../../src/core/credits-policy";
import {
  marketplaceFixture,
  marketActors,
  marketLabels,
} from "../fixtures/marketplace-state";
const now = 1791936000000;
test("local fixtures are generated for actual Auth identities without rewriting hashed journals", () => {
  const actors = marketActors.map((a, i) => ({
    ...a,
    id: `10000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`,
  }));
  const state = marketplaceFixture(now, actors);
  validateCredits(state);
  assert.ok(
    Object.values(state.commerce.cards)
      .filter((c) => c.owner !== null)
      .every((c) => actors.some((a) => a.id === c.owner)),
    "Fixture ownership matches input actors",
  );
});
function harness() {
  let s = marketplaceFixture(now),
    seq = 0;
  const run = (i: number, c: unknown, id = `r${++seq}`, at = now) => {
    const out = executeCredits(s, marketActors[i], id, c, at);
    s = out.state;
    return out.result as any;
  };
  const own = (i: number) =>
    Object.keys(s.cards).filter(
      (id) => s.commerce.cards[id].owner === marketActors[i].id,
    );
  return {
    run,
    own,
    get s() {
      return s;
    },
  };
}
test("listing, fresh consent, exact 1000/950/50 receipt, ownership, replay and private history", () => {
  const h = harness(),
    card = h.own(0)[0],
    before = wallet(h.s, marketActors[0].id).spendable;
  h.run(0, { kind: "list", card, price: 1000 }, "L");
  h.run(1, { kind: "review-buy", listing: "L" }, "Q");
  const cmd = memberTestCommand({
    kind: "buy",
    listing: "L",
    review: "Q",
    expectedPrice: 1000,
    policy: h.s.policy.version,
    confirmed: true,
  });
  const r = h.run(1, cmd, "BUY");
  assert.deepEqual(h.run(1, cmd, "BUY", now + 999999), r);
  assert.equal(r.receipt.price, 1000);
  assert.equal(r.receipt.fee, 50);
  assert.equal(r.receipt.net, 950);
  assert.equal(wallet(h.s, marketActors[0].id).spendable, before + 950);
  assert.equal(financialReport(h.s).commission, 50);
  assert.equal(h.s.commerce.cards[card].owner, marketActors[1].id);
  assert.equal(wallet(h.s, marketActors[0].id).withdrawable, 0);
  const q = marketQuery.parse({ tab: "activity" });
  assert.equal(
    marketplaceView(h.s, marketActors[0].id, marketLabels, q, undefined, now)
      .rows[0].receipt?.net,
    950,
  );
  assert.equal(
    marketplaceView(h.s, marketActors[2].id, marketLabels, q, undefined, now)
      .rows.length,
    0,
  );
  assert.throws(
    () => h.run(1, { ...cmd, expectedPrice: 1 }, "BUY"),
    /Idempotency/,
  );
  assert.throws(
    () => memberTestCommand({ ...cmd, review: undefined }),
    /Review/,
  );
});
test("stale review, self purchase, forged amounts, insufficiency, two buyers and cancel versus buy are all or nothing", () => {
  const h = harness(),
    card = h.own(0)[0];
  h.run(0, { kind: "list", card, price: 1000 }, "L");
  assert.throws(() => h.run(0, { kind: "list", card, price: 5 }), /Already/);
  assert.throws(
    () => h.run(0, { kind: "review-buy", listing: "L" }),
    /unavailable/,
  );
  h.run(1, { kind: "review-buy", listing: "L" }, "Q1");
  h.run(2, { kind: "review-buy", listing: "L" }, "Q2");
  const c = {
    kind: "buy",
    listing: "L",
    review: "Q1",
    expectedPrice: 1000,
    policy: h.s.policy.version,
    confirmed: true,
  };
  const before = structuredClone(h.s);
  assert.throws(() => h.run(1, c, "expired", now + 300000), /expired/);
  assert.deepEqual(h.s, before);
  assert.throws(() => h.run(1, { ...c, expectedPrice: 1 }), /stale/);
  assert.throws(() => h.run(1, { ...c, commission: 0 }));
  assert.deepEqual(h.s, before);
  h.run(1, c);
  const sold = structuredClone(h.s);
  assert.throws(() => h.run(2, { ...c, review: "Q2" }), /stale/);
  assert.throws(
    () => h.run(0, { kind: "cancel-listing", listing: "L" }),
    /sold/,
  );
  assert.deepEqual(h.s, sold);
  h.run(0, { kind: "list", card: h.own(0)[0], price: 1000000 }, "expensive");
  h.run(1, { kind: "review-buy", listing: "expensive" }, "QE");
  const empty = structuredClone(h.s);
  assert.throws(
    () =>
      h.run(1, {
        ...c,
        listing: "expensive",
        review: "QE",
        expectedPrice: 1000000,
      }),
    /Insufficient/,
  );
  assert.deepEqual(h.s, empty);
  h.run(0, { kind: "cancel-listing", listing: "expensive" }, "cancel");
  h.run(0, { kind: "cancel-listing", listing: "expensive" }, "cancel-again");
  assert.equal(h.s.listings.expensive.status, "CANCELLED");
});
test("active swap reserves both cards; exact expiry releases effective claim, acceptance denied and no fee escalation", () => {
  const h = harness(),
    a = h.own(0)[0],
    b = h.own(1)[0];
  h.run(0, { kind: "list", card: a, price: 1000 }, "L");
  h.run(
    0,
    {
      kind: "offer",
      other: marketActors[1].id,
      give: [a],
      take: [b],
      feeEach: 50,
    },
    "S",
  );
  assert.throws(
    () => h.run(1, { kind: "review-buy", listing: "L" }),
    /reserved/,
  );
  assert.throws(
    () => h.run(1, { kind: "list", card: b, price: 100 }),
    /reserved/,
  );
  const before = structuredClone(h.s);
  assert.throws(
    () =>
      h.run(
        1,
        { kind: "accept", swap: "S", feeEach: 50 },
        "expired",
        now + 86400000,
      ),
    /expired/,
  );
  assert.deepEqual(h.s, before);
  const view = memberTestView(
    h.s,
    marketActors[0].id,
    marketLabels,
    false,
    now + 86400000,
  );
  assert.equal(view.swaps[0].status, "EXPIRED");
  h.run(0, { kind: "expire-swap", swap: "S" }, "expire", now + 86400000);
  h.run(0, { kind: "expire-swap", swap: "S" }, "expire2", now + 86400000);
  assert.equal(h.s.swaps.S.status, "EXPIRED");
  h.run(1, { kind: "list", card: b, price: 100 }, "available", now + 86400000);
});
test("stable cursor pages, filters, own listings and private projections", () => {
  const h = harness();
  for (const [i, card] of h.own(0).entries())
    h.run(0, { kind: "list", card, price: 1000 }, `L${i}`);
  const q = marketQuery.parse({ limit: 3, sort: "price-asc" });
  const a = marketplaceView(
    h.s,
    marketActors[1].id,
    marketLabels,
    q,
    undefined,
    now,
  );
  const b = marketplaceView(
    h.s,
    marketActors[1].id,
    marketLabels,
    { ...q, cursor: a.next! },
    undefined,
    now,
  );
  assert.equal(new Set([...a.rows, ...b.rows].map((l) => l.id)).size, 6);
  assert.ok(a.next);
  assert.throws(
    () =>
      marketplaceView(
        h.s,
        marketActors[1].id,
        marketLabels,
        { ...q, q: "changed", cursor: a.next! },
        undefined,
        now,
      ),
    /Filters/,
  );
  assert.equal(
    marketplaceView(
      h.s,
      marketActors[1].id,
      marketLabels,
      marketQuery.parse({ own: "only" }),
      undefined,
      now,
    ).rows.length,
    0,
  );
  assert.equal(
    marketplaceView(
      h.s,
      marketActors[1].id,
      marketLabels,
      marketQuery.parse({ q: "not-a-player" }),
      undefined,
      now,
    ).rows.length,
    0,
  );
  assert.ok(
    a.rows.every(
      (r) => !("member" in r) && !("buyer" in r) && r.receipt === null,
    ),
  );
  assert.ok(
    a.inventory.every(
      (c) => h.s.commerce.cards[c.id].owner === marketActors[1].id,
    ),
  );
});
test("commission half-up, Core restriction and economy isolation", () => {
  assert.deepEqual(
    [6, 7, 20, 100, 1000].map((p) => sellerQuote(p).fee),
    [0, 0, 1, 5, 50],
  );
  const h = harness(),
    card = h.own(0)[0];
  const altered = structuredClone(h.s);
  Object.assign(altered.policy, { liveEnabled: true });
  assert.throws(
    () =>
      marketplaceView(
        altered,
        marketActors[0].id,
        marketLabels,
        marketQuery.parse({}),
      ),
    /Test-only/,
  );
  const core = structuredClone(h.s);
  delete core.economy;
  core.commerce.cards[card].tier = "CORE" as "RARE";
  assert.throws(
    () =>
      executeCredits(
        core,
        marketActors[0],
        "bad",
        { kind: "list", card, price: 1 },
        now,
      ),
    /Ownership/,
  );
});

test("owner-only reservation details, versioned salary, unavailable context and nonfinancial cancellation/swap activity", () => {
  const h = harness(),
    card = h.own(0)[0];
  h.run(0, { kind: "list", card, price: 100 }, "L");
  const context = {
    reserved: [card],
    ownerReservations: [
      {
        card,
        competition: "private-round",
        name: "Private team round",
        slot: "QB1",
        withdrawable: true,
      },
    ],
    rounds: [],
  };
  const view = (i: number, q: unknown = {}) =>
    marketplaceView(
      h.s,
      marketActors[i].id,
      marketLabels,
      marketQuery.parse(q),
      context,
      now,
    );
  const owner = view(0, { tab: "listings" }),
    buyer = view(1);
  assert.equal(owner.rows[0].card.ownerReservations[0].slot, "QB1");
  assert.equal(
    buyer.rows.length,
    0,
    "Reserved listings are excluded from Browse",
  );
  assert.ok(!JSON.stringify(buyer).includes("private-round"));
  assert.ok(owner.rows[0].card.salary! >= 600000);
  assert.equal(
    view(0, { round: "unknown", sell: card }).inventory[0].salary,
    null,
  );
  const journals = h.s.journal.length;
  h.run(0, { kind: "cancel-listing", listing: "L" }, "C");
  const cancellation = view(0, {
    tab: "activity",
    activityType: "cancellation",
  }).activity[0];
  assert.equal(
    cancellation,
    undefined,
    "Cancellations retained in audit, excluded from sale Activity",
  );
  assert.equal(h.s.journal.length, journals);
  assert.equal(view(1, { tab: "activity" }).activity.length, 0);
  h.run(
    0,
    {
      kind: "offer",
      other: marketActors[1].id,
      give: [card],
      take: [h.own(1)[0]],
      feeEach: 50,
    },
    "S",
  );
  h.run(1, { kind: "reject", swap: "S" }, "R");
  assert.equal(
    view(0, { tab: "activity", activityType: "swap" }).activity.length,
    0,
  );
  assert.equal(view(2, { tab: "activity" }).activity.length, 0);
  assert.equal(h.s.journal.length, journals);
  assert.deepEqual(sellerQuote(100), {
    price: 100,
    fee: 5,
    net: 95,
    policy: sellerQuote(100).policy,
  });
});

test("fresh rejection distinguishes cancelled listing and exact credit shortfall without partial grant", () => {
  const h = harness(),
    card = h.own(0)[0];
  h.run(0, { kind: "list", card, price: 1000000 }, "L");
  h.run(1, { kind: "review-buy", listing: "L" }, "Q");
  const before = structuredClone(h.s),
    shortfall = 1000000 - wallet(h.s, marketActors[1].id).spendable;
  assert.throws(
    () =>
      h.run(1, {
        kind: "buy",
        listing: "L",
        review: "Q",
        expectedPrice: 1000000,
        policy: h.s.policy.version,
        confirmed: true,
      }),
    (e) =>
      e instanceof Error &&
      e.message.includes(shortfall.toLocaleString("en-AU")),
  );
  assert.deepEqual(h.s, before);
  h.run(0, { kind: "cancel-listing", listing: "L" });
  assert.throws(
    () => h.run(1, { kind: "review-buy", listing: "L" }),
    /cancelled/,
  );
});

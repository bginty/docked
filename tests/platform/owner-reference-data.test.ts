import { test } from "node:test";
import assert from "node:assert/strict";
import {
  dashboardChange,
  type OwnerReferenceAggregate,
} from "../../src/core/owner-reference-data";
import { ownerReferenceProjection } from "../../src/core/owner-reference-projection";
import {
  marketplaceFixture,
  marketActors,
} from "../fixtures/marketplace-state";
import { executeCredits } from "../../src/core/credits-sandbox";
import type { Operations } from "../../src/core/owner-operations";

const start = Date.parse("2026-10-14T00:00:00Z"),
  end = start + 86400000;
const range = {
  startAt: new Date(start).toISOString(),
  endAt: new Date(end).toISOString(),
  sport: "all",
};
const operations: Operations = {
  scope: "beta",
  generatedAt: new Date(end).toISOString(),
  metrics: {},
  competitions: [],
  inventory: [],
  reports: [],
  emailFailures: 0,
  limitations: [],
};
const aggregate: OwnerReferenceAggregate = {
  memberIds: marketActors.map((a) => a.id),
  usersCurrent: 3,
  usersPrevious: 2,
  newUsersCurrent: 1,
  newUsersPrevious: 2,
  registrations: [{ day: "2026-10-14", registrations: 1, cumulative: 3 }],
  circulationCurrent: 27,
  circulationPrevious: 0,
  moderation: { content: 0, members: 0, listings: 0 },
  recent: [],
};

test("dashboard ratios preserve negative growth, zero baselines and unavailable data", () => {
  assert.equal(dashboardChange(2, 4), -50);
  assert.equal(dashboardChange(0, 4), -100);
  assert.equal(dashboardChange(4, 0), null);
  assert.equal(dashboardChange(null, 4), null);
});

test("purchases count once at purchase time, not openings/replays; economics remain test credits", () => {
  let state = marketplaceFixture(start - 1);
  const actor = marketActors[0];
  state = executeCredits(
    state,
    actor,
    "new-purchase",
    {
      kind: "buy-pack",
      product: "standard-nine-seven-test-v2",
      configuration: "standard-nine-seven-test-v2",
      policy: state.policy.version,
      confirmed: true,
    },
    start,
  ).state;
  const before = structuredClone(state);
  const result = ownerReferenceProjection(aggregate, state, operations, range);
  assert.equal(result.kpis.packs.current, 1);
  assert.equal(result.kpis.packs.previous, 3);
  assert.equal(result.packSales[0].sold, 1);
  assert.equal(result.packSales[0].testCredits, 900);
  assert.equal(result.packSales[0].revenueAud, null);
  assert.equal(result.kpis.revenue.current, null);
  assert.equal(result.revenueSeries, null);
  assert.deepEqual(state, before);
  assert.ok(!JSON.stringify(result).includes(actor.id));
  state = executeCredits(
    state,
    actor,
    "open-new",
    { kind: "open-pack", entitlement: "new-purchase" },
    start + 1000,
  ).state;
  state = executeCredits(
    state,
    actor,
    "open-replay",
    { kind: "open-pack", entitlement: "new-purchase" },
    start + 2000,
  ).state;
  assert.equal(
    ownerReferenceProjection(aggregate, state, operations, range).kpis.packs
      .current,
    1,
  );
  assert.equal(
    ownerReferenceProjection(aggregate, state, operations, {
      ...range,
      sport: "football",
    }).kpis.packs.current,
    0,
  );
  const absent = ownerReferenceProjection(aggregate, null, operations, range);
  assert.equal(absent.kpis.packs.current, null);
  assert.equal(absent.kpis.trades.current, null);
  assert.ok(
    absent.health
      .filter((h) => h.id !== "database")
      .every((h) => h.status === "unknown"),
  );
});

test("completed sales and swaps use immutable settlement evidence and do not count pending/cancelled offers", () => {
  let state = marketplaceFixture(start);
  const own = (i: number) =>
    Object.keys(state.cards).filter(
      (id) => state.commerce.cards[id].owner === marketActors[i].id,
    );
  const run = (i: number, id: string, c: unknown, at = start + 100) => {
    state = executeCredits(state, marketActors[i], id, c, at).state;
  };
  const card = own(0)[0];
  run(0, "listing", { kind: "list", card, price: 1000 });
  run(1, "review", { kind: "review-buy", listing: "listing" });
  const buy = {
    kind: "buy",
    listing: "listing",
    review: "review",
    expectedPrice: 1000,
    policy: state.policy.version,
    confirmed: true,
  };
  run(1, "buy", buy);
  run(1, "buy", buy);
  run(0, "pending", { kind: "list", card: own(0)[0], price: 2000 });
  const give = own(0)[1],
    take = own(1)[1];
  run(0, "swap", {
    kind: "offer",
    other: marketActors[1].id,
    give: [give],
    take: [take],
    feeEach: state.policy.swapFeeEach,
  });
  run(1, "accept", {
    kind: "accept",
    swap: "swap",
    feeEach: state.policy.swapFeeEach,
  });
  const result = ownerReferenceProjection(aggregate, state, operations, range);
  assert.equal(result.kpis.trades.current, 2);
  assert.equal(result.topCards.length, 1);
  assert.equal(result.topCards[0].sales, 1);
  assert.equal(result.topCards[0].testCredits, 1000);
  assert.equal(result.topCards[0].revenueAud, null);
  const soldInstance = state.economy!.instances[card];
  assert.equal(result.topCards[0].thumbnail?.team, soldInstance.printedTeam);
  assert.equal(result.topCards[0].thumbnail?.serial, soldInstance.serial);
  assert.equal(
    result.topCards[0].thumbnail?.max_supply,
    soldInstance.lifetimeCap,
  );
  assert.ok(result.recent.some((r) => r.href === "/admin/marketplace"));
  assert.ok(result.recent.some((r) => r.href === "/admin/workspace/packs"));
  assert.ok(
    [...result.recent, ...result.health].every(
      (row) =>
        !row.href.includes("/workspaces/") &&
        !row.href.includes("#platform-health"),
    ),
  );
  assert.equal(
    ownerReferenceProjection(
      { ...aggregate, memberIds: [marketActors[0].id] },
      state,
      operations,
      range,
    ).kpis.trades.current,
    0,
  );
  assert.equal(
    ownerReferenceProjection(aggregate, state, operations, {
      ...range,
      sport: "football",
    }).kpis.trades.current,
    0,
  );
  assert.equal(
    ownerReferenceProjection(aggregate, state, operations, {
      ...range,
      startAt: new Date(end).toISOString(),
      endAt: new Date(end + 86400000).toISOString(),
    }).kpis.trades.current,
    0,
  );
});

test("an in-progress report excludes future-dated purchases using its authoritative server timestamp", () => {
  const state = marketplaceFixture(start + 5000);
  const report = ownerReferenceProjection(
    aggregate,
    state,
    { ...operations, generatedAt: new Date(start + 1000).toISOString() },
    range,
  );
  assert.equal(report.kpis.packs.current, 0);
  assert.equal(report.packSales.length, 0);
  assert.equal(report.recent.filter((r) => r.kind === "pack").length, 0);
  assert.equal(report.period.end, new Date(start + 1000).toISOString());
  assert.equal(
    report.period.previousStart,
    new Date(start - 86400000).toISOString(),
  );
});

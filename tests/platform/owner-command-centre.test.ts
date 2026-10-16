import { test } from "node:test";
import assert from "node:assert/strict";
import { ownerAlerts } from "../../src/core/owner-command-centre";
import { ownerWalletSummary } from "../../src/core/owner-wallet-summary";
import { initialCredits } from "../../src/core/credits-sandbox";
import { packFixture } from "../fixtures/pack-economy";
import type { Operations } from "../../src/core/owner-operations";
test("owner wallet projection reads the existing ledger without exposing identities or fabricating cash receipts", () => {
  const state = packFixture();
  const before = structuredClone(state);
  const view = ownerWalletSummary(state);
  assert.equal(view.actualCashReceipts, null);
  assert.equal(view.difference, 0);
  assert.equal(view.spendable, 25000);
  assert.equal(view.issued, 25000);
  assert.equal(view.categories.promotional, 25000);
  assert.equal("balances" in view, false);
  assert.equal("fundingLots" in view, false);
  assert.equal("transactions" in view, false);
  assert.throws(
    () =>
      ownerWalletSummary({
        ...state,
        policy: {
          ...state.policy,
          liveEnabled: true,
        } as unknown as typeof state.policy,
      }),
    /Test reporting/,
  );
  // No mutation or parallel wallet is introduced by reading the report.
  assert.deepEqual(state, before);
});
test("owner alerts use stored evidence and server report time, not a guessed outage", () => {
  const data: Operations = {
    scope: "beta",
    generatedAt: "2026-10-16T12:00:00Z",
    metrics: {},
    competitions: [],
    inventory: [],
    reports: [],
    emailFailures: 0,
    limitations: [],
    centre: {
      activeMembers: 0,
      packsOpened: 0,
      entriesUpdated: 0,
      posts: 0,
      pendingInvitations: 0,
      suspendedMembers: 0,
      daily: [],
      packFailures: [],
      workerRuns: [],
      lastRosterSync: null,
      weeklyEnabled: false,
      inventorySummary: [],
      limitations: [],
      feedJobs: [
        {
          id: "future",
          provider: "fixture",
          state: "leased",
          attempts: 1,
          error_code: null,
          last_success: null,
          available_at: "2026-10-16T11:00:00Z",
          lease_until: "2026-10-16T13:00:00Z",
        },
        {
          id: "expired",
          provider: "fixture",
          state: "leased",
          attempts: 2,
          error_code: null,
          last_success: null,
          available_at: "2026-10-16T10:00:00Z",
          lease_until: "2026-10-16T11:59:00Z",
        },
      ],
    },
  };
  assert.deepEqual(
    ownerAlerts(data).map((a) => a.id),
    ["expired"],
  );
  data.centre!.feedJobs = [];
  assert.deepEqual(ownerAlerts(data), []);
  data.wallet = { ...ownerWalletSummary(initialCredits()), difference: 1 };
  data.reports = [
    { id: "report", created_at: data.generatedAt, status: "open" },
  ];
  assert.equal(ownerAlerts(data)[0].severity, "critical");
  assert.equal(ownerAlerts(data)[1].id, "report");
});

test("pending offer totals exclude expiry at the authoritative reporting instant", () => {
  const state = initialCredits();
  const at = Date.parse("2026-10-16T12:00:00Z");
  const offer = {
    id: "offer",
    buyer: "buyer",
    seller: "seller",
    card: "card",
    version: 1,
    price: 100,
    policy: "fixture",
    created: at - 1000,
    expires: at,
    status: "OPEN" as const,
  };
  state.privateCardOffers = {
    expired: offer,
    future: { ...offer, id: "future", expires: at + 1 },
    closed: { ...offer, id: "closed", expires: at + 1, status: "DECLINED" },
  };
  assert.equal(ownerWalletSummary(state, at).pendingOffers, 1);
  assert.equal(ownerWalletSummary(state, at + 1).pendingOffers, 0);
  assert.equal(state.privateCardOffers.expired.status, "OPEN");
});

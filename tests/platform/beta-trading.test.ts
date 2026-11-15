import { test } from "node:test";
import assert from "node:assert/strict";
import {
  betaTradingPolicy,
  localTrading,
  reviewedBetaTrading,
  tradingCommandMode,
  assertTradingWriteAvailable,
} from "../../src/core/beta-trading";
test("deployment pause blocks every trading mutation, including fixture sports, while free-credit packs and cancellation remain available", () => {
  const env = {
    DOCKED_TEST_MARKET_READ_ONLY: "true",
    DOCKED_SPORTS_TEST_COMMERCE: "true",
  };
  for (const sport of ["nfl", "afl", "nrl"]) {
    for (const kind of [
      "list",
      "replace-listing",
      "reprice-listing",
      "buy",
      "review-buy",
      "offer",
      "accept",
      "private-offer",
      "private-accept",
    ])
      assert.throws(
        () => assertTradingWriteAvailable({ kind, sport }, env),
        /Trading is temporarily unavailable/,
      );
    for (const kind of [
      "promotion",
      "buy-pack",
      "open-pack",
      "cancel-listing",
      "cancel-swap",
      "reject",
      "private-cancel",
      "private-decline",
      "expire-swap",
    ])
      assert.doesNotThrow(() =>
        assertTradingWriteAvailable({ kind, sport }, env),
      );
  }
});
test("hosted trading needs its own explicit capability, never a funding flag or local flag", () => {
  assert.equal(
    reviewedBetaTrading({
      PAID_PLANS_ENABLED: "true",
      DOCKED_PRIVATE_OFFERS_LOCAL: "true",
    }),
    false,
  );
  const enabled = {
    DOCKED_BETA_TRADING: betaTradingPolicy,
    DOCKED_FRIENDS_BETA: "true",
    DOCKED_BETA_STAGING: "true",
    PAID_PLANS_ENABLED: "false",
    REGISTRATION_ENABLED: "false",
  };
  assert.equal(reviewedBetaTrading(enabled), true);
  assert.equal(
    reviewedBetaTrading({ ...enabled, DOCKED_BETA_STAGING: "false" }),
    false,
  );
  assert.equal(
    localTrading({
      DATABASE_URL: "postgres://local@127.0.0.1/db",
      VERCEL: "1",
    }),
    false,
  );
  assert.equal(
    localTrading({
      DATABASE_URL: "postgres://local@127.0.0.1/db",
      NODE_ENV: "production",
    }),
    false,
  );
  assert.equal(
    localTrading({ DATABASE_URL: "postgres://local@remote.example/db" }),
    false,
  );
});
test("mode gates distinguish sale, swap and combined and leave cancellation available", () => {
  assert.equal(tradingCommandMode({ kind: "buy" }), "sale");
  assert.equal(
    tradingCommandMode({ kind: "list", preference: "both" }),
    "listing",
  );
  assert.equal(
    tradingCommandMode({ kind: "private-offer", price: 100 }),
    "sale",
  );
  assert.equal(
    tradingCommandMode({
      kind: "private-offer",
      price: 0,
      offeredCards: ["card"],
    }),
    "swap",
  );
  assert.equal(
    tradingCommandMode({
      kind: "private-offer",
      price: 100,
      offeredCards: ["card"],
    }),
    "combined",
  );
  for (const kind of [
    "cancel-listing",
    "cancel-swap",
    "reject",
    "private-cancel",
    "private-decline",
    "expire-swap",
    "open-pack",
  ])
    assert.equal(tradingCommandMode({ kind }), null);
});

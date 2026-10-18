import { test } from "node:test";
import assert from "node:assert/strict";
import {
  betaTradingPolicy,
  localTrading,
  reviewedBetaTrading,
  tradingCommandMode,
} from "../../src/core/beta-trading";
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

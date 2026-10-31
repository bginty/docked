import { initialMemberTestCredits } from "../../src/core/member-test-wallet";
import { paidPackCatalogueUpgrade } from "../../src/core/card-economy";
import { packFixture, packMember, packNow } from "./pack-economy";
import { newCreditOnly } from "../../src/core/credit-only";
import {
  executeCredits,
  type CreditsState,
} from "../../src/core/credits-sandbox";
import { settleStoreTestReceipt } from "../../src/server/store-test-settlement";
import type { StoreReceipt } from "../../src/server/store-purchase-verification";

export { packMember, packNow };
/** Disposable fixture only; same wallet and pack engine, no promotional funding. */
export function storePackFixture(sport: "nfl" | "afl" | "nrl" = "nfl") {
  const state = initialMemberTestCredits();
  state.creditOnly = newCreditOnly();
  state.economy = packFixture(sport).economy;
  if (sport === "nfl") paidPackCatalogueUpgrade(state.economy!, packNow);
  return state;
}
export function storePackReceipt(
  key = "store-pack-fixture",
  credits = 9900,
): StoreReceipt {
  return {
    provider: "google",
    key,
    account: "synthetic-account-binding",
    environment: "test",
    state: "PURCHASED",
    product: {
      id: "synthetic-credit-package",
      scope: "account",
      credits,
      version: "fixture-v1",
    },
  };
}
export function settleFixture(
  state: CreditsState,
  receipt: StoreReceipt,
  member: string = packMember.id,
) {
  return settleStoreTestReceipt(
    state,
    receipt,
    member,
    receipt.account,
    packNow,
  ).state;
}
export function buyFixturePack(
  state: CreditsState,
  product: string,
  key = "pack",
) {
  const p = state.economy!.products[product];
  return executeCredits(
    state,
    packMember,
    key,
    {
      kind: "buy-pack",
      product,
      configuration: p.version,
      expectedPrice: p.priceCredits,
      confirmed: true,
      policy: state.policy.version,
    },
    packNow,
  ).state;
}

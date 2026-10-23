import { test } from "node:test";
import assert from "node:assert/strict";
import { packShopHref, packTab } from "../../src/core/pack-presentation";

test("Cards links use the existing pack shop and preserve sport and My Packs", () => {
  for (const sport of ["basketball", "afl", "nrl", "nfl"]) {
    const buy = new URL(packShopHref(sport), "https://docked.example");
    assert.equal(buy.pathname, "/fantasy/test-wallet");
    assert.equal(buy.searchParams.get("view"), "packs");
    assert.equal(buy.searchParams.get("sport"), sport);
    assert.equal(packTab(buy.search), "buy");
    for (const tab of ["mine", "history"] as const) {
      const url = new URL(packShopHref(sport, tab), buy);
      assert.equal(url.searchParams.get("sport"), sport);
      assert.equal(packTab(url.search), tab);
    }
  }
});

test("legacy pack tabs resolve without overriding the current tab parameter", () => {
  assert.equal(packTab("?sport=basketball&tab=mine"), "mine");
  assert.equal(packTab("?tab=history"), "history");
  assert.equal(packTab("?packs=buy&tab=mine"), "buy");
  assert.equal(packTab("?tab=unknown"), "buy");
  assert.equal(packTab("", "#pack-history"), "history");
  assert.equal(packShopHref(), "/fantasy/test-wallet?view=packs");
});

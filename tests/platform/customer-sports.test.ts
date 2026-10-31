import test from "node:test";
import assert from "node:assert/strict";
import {
  customerSports,
  assertCustomerSport,
  isHiddenCustomerSport,
} from "../../src/core/customer-sports";
import { sportPrivateBetaEnabled } from "../../src/core/sports-private-beta";
import release from "../../config/mobile-store-release.json";

test("mobile/web scope includes only NFL AFL NRL and rejects hidden sport even with legacy flags", () => {
  assert.deepEqual(customerSports, ["nfl", "afl", "nrl"]);
  assert.deepEqual(release.customerSports, customerSports);
  for (const sport of customerSports)
    assert.doesNotThrow(() => assertCustomerSport(sport));
  for (const sport of [
    "basketball",
    "nba",
    "football",
    "nbl",
    "NFL",
    "__proto__",
    undefined,
  ])
    assert.throws(() => assertCustomerSport(sport));
  assert.equal(isHiddenCustomerSport("basketball"), true);
  assert.equal(
    sportPrivateBetaEnabled("basketball", {
      DOCKED_NBA_PRIVATE_BETA: "true",
      DOCKED_SPORTS_PRIVATE_BETA: "true",
    }),
    false,
  );
  assert.equal(sportPrivateBetaEnabled("afl", {}), false);
});
test("store preparation cannot activate money, prizes or public access", () => {
  for (const [key, value] of Object.entries(release))
    if (key.endsWith("Approved")) assert.equal(value, false, key);
  assert.deepEqual(release.googleProducts, []);
  assert.deepEqual(release.appleProducts, []);
});

import test from "node:test";
import assert from "node:assert/strict";
import { nativeDeepLink } from "../../src/core/native-navigation";
import { storeInternalTarget } from "../../scripts/store-internal-target.mjs";
test("native links preserve visible sport and reject hidden/ambiguous/malicious context", () => {
  for (const sport of ["nfl", "afl", "nrl"])
    assert.equal(
      nativeDeepLink(`docked://fantasy/cards?sport=${sport}`),
      `/fantasy/cards?sport=${sport}`,
    );
  for (const query of [
    "sport=basketball",
    "sport=nbl",
    "sport=afl&sport=nrl",
    "sport=afl&next=https://evil.example",
    "sport=afl&view=unsafe",
  ])
    assert.equal(nativeDeepLink(`docked://fantasy/cards?${query}`), null);
  assert.equal(
    nativeDeepLink("docked://fantasy/cards?tab=packs&sport=afl&packs=history"),
    "/fantasy/cards?tab=packs&sport=afl&packs=history",
  );
});
test("internal native build is HTTPS-only and does not weaken old release targets", () => {
  assert.equal(storeInternalTarget({}), null);
  const target = storeInternalTarget({ DOCKED_STORE_INTERNAL: "true" })!;
  assert.equal(target.entryUrl, "https://docked.com.au/app");
  assert.equal(target.manifest.applicationId, "docked.fantasy");
  assert.equal(target.inspect, false);
  assert.equal(target.cleartext, false);
  assert.throws(() =>
    storeInternalTarget({
      DOCKED_STORE_INTERNAL: "true",
      CAPACITOR_PREVIEW_DEBUGGING: "1",
    }),
  );
  assert.throws(() =>
    storeInternalTarget({
      DOCKED_STORE_INTERNAL: "true",
      CAPACITOR_PREVIEW_SERVER: "http://localhost:3000",
    }),
  );
});

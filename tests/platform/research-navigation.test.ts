import { test } from "node:test";
import assert from "node:assert/strict";
import {
  nativeDeepLink,
  nativeNotificationRoute,
} from "../../src/core/native-navigation";
test("reviewed research native links are retired even within the approved origin without broadening push routes", () => {
  const id = "00000000-0000-4000-8000-000000000001",
    route = `/research/matches/${id}`,
    origin = "https://docked-preview.example.invalid";
  assert.equal(nativeDeepLink(`docked://research/matches/${id}`), null);
  assert.equal(nativeDeepLink(`${origin}${route}`, origin), null);
  for (const value of [
    `https://other.example.invalid${route}`,
    `${origin}${route}?token=secret`,
    `${origin}${route}#part`,
    `${origin}/research/matches/provider-event`,
    `${origin}/admin/research/${id}`,
  ])
    assert.equal(nativeDeepLink(value, origin), null);
  assert.equal(nativeNotificationRoute({ type: "system", path: route }), null);
});

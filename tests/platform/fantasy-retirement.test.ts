import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import {
  retiredProductRoots,
  retiredProductPath,
} from "../../src/core/retired-product";
import {
  nativeDeepLink,
  nativeNotificationRoute,
} from "../../src/core/native-navigation";
import {
  fantasyPresentationEnabled,
  fantasyPlatformEnabled,
} from "../../src/core/fantasy-production";
import { assertDeploymentEnvironment } from "../../src/core/deployment-environment";
import { notificationActionSchema } from "../../src/core/community-social";
import { previewCapabilitySet } from "../../src/core/preview-testers";
import { canonical, hash } from "../../src/core/canonical-hash";

test("retired routes include descendants without blocking fantasy marketplace or social posts", () => {
  for (const root of retiredProductRoots) {
    assert.equal(retiredProductPath(root), true);
    assert.equal(retiredProductPath(root + "/record"), true);
  }
  for (const route of [
    "/fantasy/play",
    "/fantasy/market",
    "/api/fantasy",
    "/community/posts/record",
    "/api/community",
    "/api/auth",
  ])
    assert.equal(retiredProductPath(route), false);
  for (const file of [
    "src/providers/odds-api.ts",
    "src/providers/odds-papi.ts",
    "src/server/edge-scanner.ts",
    "src/server/publication.ts",
    "scripts/worker.ts",
  ])
    assert.equal(existsSync(file), false, file);
});
test("fantasy identity cannot grant gameplay, and retired switches cannot reactivate services", () => {
  assert.equal(fantasyPresentationEnabled({}), true);
  assert.equal(fantasyPlatformEnabled({}), false);
  for (const flag of [
    "ODDS_POLLING_ENABLED",
    "MARKET_DATA_POLLING_ENABLED",
    "EDGE_SCANNER_ENABLED",
    "RESEARCH_AUTOMATION_ENABLED",
    "PUBLICATION_ENABLED",
    "FORWARD_PAPER_ENABLED",
    "AUTO_PUBLISH_DOCKED_EDGES",
  ])
    assert.throws(
      () => assertDeploymentEnvironment({ [flag]: "true" }),
      /Retired/,
    );
});
test("Android accepts only current fantasy destinations and rejects retired push families", () => {
  for (const tab of ["play", "cards", "market", "social", "profile"])
    assert.equal(nativeDeepLink("docked://fantasy/" + tab), "/fantasy/" + tab);
  const id = "00000000-0000-4000-8000-000000000001";
  for (const route of [
    "edges",
    "tips",
    "results",
    "research/matches",
    "community/edges",
  ])
    assert.equal(nativeDeepLink(`docked://${route}/${id}`), null);
  assert.equal(
    nativeNotificationRoute({ type: "official_edge", path: `/tips/${id}` }),
    null,
  );
});
test("notification and invitation APIs cannot opt into retired capabilities", () => {
  const preference = {
    action: "preferences",
    followedMembers: true,
    social: true,
    inApp: true,
    email: false,
    push: false,
  };
  assert.equal(notificationActionSchema.safeParse(preference).success, true);
  for (const key of [
    "officialEdges",
    "researchUpdates",
    "lineupUpdates",
    "leaderboard",
    "dealsMarketing",
  ])
    assert.equal(
      notificationActionSchema.safeParse({ ...preference, [key]: true })
        .success,
      false,
    );
  assert.equal(
    previewCapabilitySet.safeParse(["community_social", "public_profiles"])
      .success,
    true,
  );
  assert.equal(
    previewCapabilitySet.safeParse([
      "community_social",
      "public_profiles",
      "preview_market_fixtures",
    ]).success,
    false,
  );
});
test("extracted account hashing preserves canonical digest semantics", () => {
  assert.equal(
    canonical({ b: 2, a: 1, missing: undefined }),
    "{" + '"a":1,"b":2}',
  );
  assert.equal(
    hash({ b: 2, a: 1 }),
    "43258cff783fe7036d8a43033f830adfc60ec037382473548ac742b888292777",
  );
  assert.throws(() => hash({ value: Infinity }), /non-finite/);
});

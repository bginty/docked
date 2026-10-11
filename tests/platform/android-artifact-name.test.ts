import test from "node:test";
import assert from "node:assert/strict";
import { androidArtifactName } from "../../scripts/android-artifact-name.mjs";
test("delivery filename follows package version and separates owner QA from friends beta", () => {
  assert.equal(
    androidArtifactName("friends", "versionCode 17"),
    "Docked-v17-NFL-Friends-Beta.apk",
  );
  assert.equal(
    androidArtifactName("owner", "versionCode 18"),
    "Docked-v18-NFL-Owner-Connected-QA.apk",
  );
  assert.throws(() => androidArtifactName("friends", "versionCode unknown"));
  assert.throws(() => androidArtifactName("unknown", "versionCode 17"));
});

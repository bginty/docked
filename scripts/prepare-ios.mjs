/** Repeatable preparation only. Does not sign, upload, buy, or enable IAP. */
import assert from "node:assert/strict";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const release = JSON.parse(
  readFileSync("config/mobile-store-release.json", "utf8"),
);
const apple = JSON.parse(
  readFileSync("ios/App/App/DockedStoreConfiguration.json", "utf8"),
);
assert.deepEqual(release.customerSports, ["nfl", "afl", "nrl"]);
assert.deepEqual(release.territories, ["AU"]);
assert.equal(release.appleBundleId, "au.com.docked.app");
assert.equal(release.paymentsApproved, false);
assert.equal(apple.enabled, false);
assert.equal(apple.environment, "sandbox");
assert.deepEqual(apple.products, []);
assert.equal(apple.origin, "https://docked.com.au");
const env = {
  ...process.env,
  DOCKED_STORE_INTERNAL: "true",
  DOCKED_STORE_PLATFORM: "ios",
};
function run(args) {
  const result = spawnSync(process.execPath, args, {
    env,
    stdio: "inherit",
    windowsHide: true,
  });
  if (result.error || result.status !== 0)
    throw Error("iOS preparation step failed");
}
run(["scripts/build-mobile-shell.mjs"]);
run([require.resolve("@capacitor/cli/bin/capacitor"), "sync", "ios"]);
// Capacitor resolves workspace junctions. Keep the committed SPM manifest
// portable to the signing Mac instead of recording this machine's worktree.
const spm = "ios/App/CapApp-SPM/Package.swift";
writeFileSync(
  spm,
  readFileSync(spm, "utf8").replace(
    /path: "[^"]*node_modules\/(@capacitor\/[^"/]+)"/g,
    'path: "../../../node_modules/$1"',
  ),
);
run(["scripts/build-ios-branding.mjs"]);
// Parse the real project, rather than checking source files that Xcode might omit.
const xcode = require("xcode"),
  project = xcode.project("ios/App/App.xcodeproj/project.pbxproj");
project.parseSync();
const sections = project.hash.project.objects;
const sourceIds = Object.values(sections.PBXSourcesBuildPhase)
  .filter((v) => typeof v === "object")
  .flatMap((v) => v.files.map((f) => f.value));
for (const file of [
  "DockedBillingPlugin.swift",
  "DockedBridgeViewController.swift",
  "StorePurchaseCoordinator.swift",
])
  assert(
    sourceIds.some(
      (id) =>
        sections.PBXFileReference[sections.PBXBuildFile[id]?.fileRef]?.path ===
        file,
    ),
    `${file} is missing from Xcode sources`,
  );
const config = JSON.parse(
  readFileSync("ios/App/App/capacitor.config.json", "utf8"),
);
assert.equal(config.appId, release.appleBundleId);
assert.equal(new URL(config.server.url).origin, apple.origin);
assert.equal(config.server.cleartext, false);
const report = {
  prepared: true,
  platform: process.platform,
  bundleId: config.appId,
  backend: config.server.url,
  sports: release.customerSports,
  billingEnabled: false,
  signed: false,
  compiled: false,
  testFlightUploaded: false,
  next: "Build and validate on an authorised Mac with Xcode 26+, Apple Developer team and App Store Connect access.",
};
mkdirSync("docs/qa/dual-store-20261105", { recursive: true });
writeFileSync(
  "docs/qa/dual-store-20261105/ios-preparation.json",
  JSON.stringify(report, null, 2) + "\n",
);
console.log(JSON.stringify(report, null, 2));

import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import { storeInternalTarget } from "./store-internal-target.mjs";
const target = storeInternalTarget(process.env);
assert(target, "Explicit internal-test build required");
const config = JSON.parse(
  readFileSync("android/app/src/main/assets/capacitor.config.json", "utf8"),
);
const packaged = JSON.parse(
  readFileSync(
    "android/app/src/main/assets/public/preview-environment.json",
    "utf8",
  ),
);
assert.equal(config.appId, target.manifest.applicationId);
assert.equal(config.server.url, target.entryUrl);
assert.equal(config.server.cleartext, false);
assert.equal(config.android.allowMixedContent, false);
assert.equal(config.android.webContentsDebuggingEnabled, false);
assert.equal(config.loggingBehavior, "none");
assert.equal(config.server.allowNavigation, undefined);
assert.deepEqual(packaged, target.manifest);
console.log(
  "Internal build: HTTPS only; NFL/AFL/NRL; purchases and public release disabled.",
);

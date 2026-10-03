import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { readFileSync } from "node:fs";
import {
  closedTestInputs,
  verifyUploadCertificate,
} from "../../scripts/android-closed-test-config.mjs";

test("closed-test signing refuses absent credentials, source-tree keys and debug keys", () => {
  const root = path.resolve("tmp/closed-test-fixture");
  const env = {
    DOCKED_UPLOAD_KEYSTORE: path.join(
      root,
      "private-data/android-signing/upload.jks",
    ),
    DOCKED_UPLOAD_ALIAS: "preview-upload",
    DOCKED_UPLOAD_STORE_PASSWORD: "fixture-only",
    DOCKED_UPLOAD_KEY_PASSWORD: "fixture-only",
  };
  const resolve = (file: string) => file;
  assert.throws(
    () => closedTestInputs({}, root, resolve),
    /OWNER_ACTION_REQUIRED/,
  );
  assert.throws(
    () =>
      closedTestInputs(
        { ...env, DOCKED_UPLOAD_KEYSTORE: "relative.jks" },
        root,
        resolve,
      ),
    /absolute/,
  );
  assert.throws(
    () =>
      closedTestInputs(
        { ...env, DOCKED_UPLOAD_KEYSTORE: path.join(root, "src/upload.jks") },
        root,
        resolve,
      ),
    /outside tracked/,
  );
  assert.throws(
    () =>
      closedTestInputs(
        {
          ...env,
          DOCKED_UPLOAD_KEYSTORE: path.join(
            root,
            "private-data/android-signing/debug.keystore",
          ),
        },
        root,
        resolve,
      ),
    /debug signing key/,
  );
  assert.throws(
    () =>
      closedTestInputs(
        { ...env, DOCKED_UPLOAD_ALIAS: "androiddebugkey" },
        root,
        resolve,
      ),
    /debug signing key/,
  );
  assert.deepEqual(closedTestInputs(env, root, resolve), {
    keystore: env.DOCKED_UPLOAD_KEYSTORE,
    alias: env.DOCKED_UPLOAD_ALIAS,
  });
  assert.equal("password" in closedTestInputs(env, root, resolve), false);
  assert.throws(() => verifyUploadCertificate("not-a-certificate"));
});

test("closed-test build has an independent upload signing gate while production stays blocked", () => {
  const gradle = readFileSync("android/app/build.gradle", "utf8");
  const variant =
    gradle.match(/closedTest \{([\s\S]*?)\n        \}/)?.[1] ?? "";
  assert.match(variant, /signingConfig signingConfigs.closedTestUpload/);
  assert.match(variant, /applicationIdSuffix "\.preview"/);
  assert.match(variant, /debuggable false/);
  assert.doesNotMatch(variant, /signingConfigs.debug/);
  assert.match(gradle, /Docked release is BLOCKED/);
  assert.match(gradle, /android-closed-test-config\.mjs/);
  assert.match(gradle, /verify-android-preview-assets\.mjs/);
  const inputs = readFileSync("scripts/android-closed-test-config.mjs", "utf8");
  assert.ok(/"-storepass:env",\s*"DOCKED_UPLOAD_STORE_PASSWORD"/.test(inputs), "Keytool must read its password from environment, not a command argument.");
  assert.doesNotMatch(inputs, /stdio: "inherit"/);
  assert.match(
    readFileSync("android/variables.gradle", "utf8"),
    /targetSdkVersion = 36/,
  );
});

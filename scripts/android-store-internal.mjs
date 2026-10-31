import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, copyFileSync } from "node:fs";
import path from "node:path";
import {
  closedTestInputs,
  verifyUploadCertificate,
} from "./android-closed-test-config.mjs";
const env = {
  ...process.env,
  DOCKED_STORE_INTERNAL: "true",
  DOCKED_STORE_PLATFORM: "android",
  CAPACITOR_LIVE_BETA: "false",
  CAPACITOR_PREVIEW_SERVER: "",
  CAPACITOR_PREVIEW_DEBUGGING: "",
};
const root = process.cwd();
const billingQa = process.argv.includes("--billing-qa");
const candidate = process.argv.includes("--public-candidate");
if (billingQa && candidate)
  throw Error("Public candidate cannot include billing QA");
if (
  billingQa &&
  !existsSync("android/app/src/storeBillingQa/res/raw/google_lab_ca.pem")
)
  throw Error("Prepare the private loopback TLS lab before the QA build");
const input = closedTestInputs(env, root);
if (!env.JAVA_HOME || !env.ANDROID_HOME)
  throw Error("JDK21 and Android SDK36 are required");
const pem = spawnSync(
  path.join(env.JAVA_HOME, "bin/keytool.exe"),
  [
    "-list",
    "-rfc",
    "-keystore",
    input.keystore,
    "-alias",
    input.alias,
    "-storepass:env",
    "DOCKED_UPLOAD_STORE_PASSWORD",
  ],
  { env, encoding: "utf8", windowsHide: true },
);
if (pem.status !== 0) throw Error("Upload certificate could not be verified");
const certificate = pem.stdout.match(
  /-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/,
)?.[0];
if (!certificate) throw Error("Upload certificate missing");
verifyUploadCertificate(certificate);
function run(command, args, cwd = root) {
  const result = spawnSync(command, args, {
    cwd,
    env,
    stdio: "inherit",
    windowsHide: true,
    shell: process.platform === "win32",
  });
  if (result.status !== 0) throw Error("Internal build step failed");
}
run("node", ["scripts/build-mobile-shell.mjs"]);
run("npx", ["cap", "sync", "android"]);
run(
  "gradlew.bat",
  candidate
    ? [
        ":app:bundleStoreCandidate",
        ":app:assembleStoreCandidate",
        ":app:lintStoreCandidate",
        "--console=plain",
      ]
    : billingQa
      ? [
          ":app:bundleStoreBillingQa",
          ":app:assembleStoreBillingQa",
          "--console=plain",
        ]
      : [
          ":app:bundleStoreInternal",
          ":app:assembleStoreInternal",
          "--console=plain",
        ],
  path.join(root, "android"),
);
mkdirSync("artifacts/android", { recursive: true });
for (const [source, target] of [
  [
    candidate
      ? "android/app/build/outputs/bundle/storeCandidate/app-storeCandidate.aab"
      : billingQa
        ? "android/app/build/outputs/bundle/storeBillingQa/app-storeBillingQa.aab"
        : "android/app/build/outputs/bundle/storeInternal/app-storeInternal.aab",
    candidate
      ? "artifacts/android/Docked-public-candidate.aab"
      : billingQa
        ? "artifacts/android/Docked-billing-qa.aab"
        : "artifacts/android/Docked-store-internal.aab",
  ],
  [
    candidate
      ? "android/app/build/outputs/apk/storeCandidate/app-storeCandidate.apk"
      : billingQa
        ? "android/app/build/outputs/apk/storeBillingQa/app-storeBillingQa.apk"
        : "android/app/build/outputs/apk/storeInternal/app-storeInternal.apk",
    candidate
      ? "artifacts/android/Docked-public-candidate.apk"
      : billingQa
        ? "artifacts/android/Docked-billing-qa.apk"
        : "artifacts/android/Docked-store-internal.apk",
  ],
]) {
  if (!existsSync(source)) throw Error("Expected native artifact missing");
  copyFileSync(source, target);
  console.log(target);
}
console.log(
  "Internal-test artifacts only. Not a public-release approval or hosted acceptance.",
);

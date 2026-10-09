import { spawnSync } from "node:child_process";
import { existsSync, copyFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { resolveAndroidTarget } from "./android-preview-config.mjs";
import { preserveAndroidApks } from "./preserve-android-apks.mjs";
import { closedTestPreflight } from "./android-closed-test-config.mjs";

// Uses the installed SDK/JDK. Does not accept new SDK licenses;
// Gradle can provision a missing build package under an existing license.
// This script never loads .env files or signs a production release.
const root = process.cwd();
const sdk = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT;
const java = process.env.JAVA_HOME;
if (!sdk || !java || !existsSync(path.join(sdk, "platforms", "android-36")))
  throw new Error(
    "Set ANDROID_HOME to the installed SDK36 and JAVA_HOME to JDK21. See docs/ANDROID_BUILD.md.",
  );
const attached = process.argv.includes("--attach-local");
const inspect = process.argv.includes("--inspect-webview");
const closedTest = process.argv.includes("--closed-test");
const liveBeta = process.argv.includes("--live-beta");
const hosted = process.argv.includes("--hosted-preview") || closedTest;
if (liveBeta && (hosted || attached || inspect))
  throw Error("Live beta is a separate HTTPS-only build.");
if (hosted && (attached || inspect))
  throw new Error(
    "Hosted preview cannot enable local attachment or inspection.",
  );
if (inspect && !attached)
  throw new Error("WebView inspection requires --attach-local.");
const env = {
  ...process.env,
  CAPACITOR_LIVE_BETA: liveBeta ? "true" : "false",
  CAPACITOR_PREVIEW_MODE: hosted ? "hosted" : attached ? "local" : "bundled",
  CAPACITOR_PREVIEW_SERVER: "",
  CAPACITOR_PREVIEW_DEBUGGING: inspect ? "1" : "",
};
resolveAndroidTarget(env);
if (closedTest) closedTestPreflight(env);
const windows = process.platform === "win32";
function run(command, args, cwd = root) {
  const result = spawnSync(command, args, {
    cwd,
    env,
    stdio: "inherit",
    shell: windows,
  });
  if (result.error || result.status !== 0) process.exit(result.status || 1);
}
const artifactOutput = path.join(
  root,
  closedTest
    ? "android/app/build/outputs/bundle"
    : "android/app/build/outputs/apk",
  closedTest ? "closedTest" : liveBeta ? "beta" : hosted ? "preview" : "debug",
);
const artifactArchive = path.join(root, "private-data/android/apk-archive");
const artifactDelivery = path.join(root, "artifacts/android");
const hostedFilename = liveBeta ? 'Docked-Protected-Beta-v10-Fantasy-Cards.apk' : 'Docked-Preview-v10-Fantasy-Cards.apk';
preserveAndroidApks(artifactDelivery, artifactArchive, [".apk", ".aab"]);
preserveAndroidApks(
  path.join(root, "android/app/build/outputs/bundle/closedTest"),
  artifactArchive,
  [".aab"],
);
for (const variant of ["debug", "preview", "beta"]) {
  preserveAndroidApks(
    path.join(root, "android/app/build/outputs/apk", variant),
    artifactArchive,
  );
}
run("node", ["scripts/build-app-icons.mjs"]);
run("node", ["scripts/build-mobile-shell.mjs"]);
run("npx", ["cap", "sync", "android"]);
run(
  windows ? "gradlew.bat" : "./gradlew",
  [
    closedTest
      ? ":app:bundleClosedTest"
      : liveBeta
        ? ":app:assembleBeta"
        : hosted
          ? ":app:assemblePreview"
          : ":app:assembleDebug",
    "--no-daemon",
    "--max-workers=2",
  ],
  path.join(root, "android"),
);
if (closedTest) {
  mkdirSync(artifactDelivery, { recursive: true });
  copyFileSync(
    path.join(artifactOutput, "app-closedTest.aab"),
    path.join(artifactDelivery, "Docked-Preview-v7-Closed-Test.aab"),
  );
  console.log(
    "Created artifacts/android/Docked-Preview-v7-Closed-Test.aab. No Play upload was performed.",
  );
} else if (hosted || liveBeta) {
  const variant = liveBeta ? "beta" : "preview";
  const output = path.join(root, "android/app/build/outputs/apk", variant);
  copyFileSync(
    path.join(output, `app-${variant}.apk`),
    path.join(output, hostedFilename),
  );
  mkdirSync(artifactDelivery, { recursive: true });
  copyFileSync(
    path.join(output, `app-${variant}.apk`),
    path.join(artifactDelivery, hostedFilename),
  );
  console.log(`Created artifacts/android/${hostedFilename}`);
}
preserveAndroidApks(artifactOutput, artifactArchive, [".apk", ".aab"]);
preserveAndroidApks(artifactDelivery, artifactArchive, [".apk", ".aab"]);

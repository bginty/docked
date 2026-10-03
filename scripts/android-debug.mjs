import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

// Uses the installed SDK/JDK. Does not accept new SDK licenses;
// Gradle can provision a missing build package under an existing license.
// This script never loads .env files, signs a release, or attaches an external origin.
const root = process.cwd();
const sdk = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT;
const java = process.env.JAVA_HOME;
if (!sdk || !java || !existsSync(path.join(sdk, "platforms", "android-36")))
  throw new Error(
    "Set ANDROID_HOME to the installed SDK36 and JAVA_HOME to JDK21. See docs/ANDROID_BUILD.md.",
  );
const attached = process.argv.includes("--attach-local");
const inspect = process.argv.includes("--inspect-webview");
if (inspect && !attached)
  throw new Error("WebView inspection requires --attach-local.");
const env = {
  ...process.env,
  CAPACITOR_PREVIEW_SERVER: attached ? "http://localhost:3000" : "",
  CAPACITOR_PREVIEW_DEBUGGING: inspect ? "1" : "",
};
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
run("node", ["scripts/build-mobile-shell.mjs"]);
run("node", ["scripts/build-mobile-shell.mjs"]);
run("npx", ["cap", "sync", "android"]);
run(
  windows ? "gradlew.bat" : "./gradlew",
  [":app:assembleDebug", "--no-daemon", "--max-workers=2"],
  path.join(root, "android"),
);

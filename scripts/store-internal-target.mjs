import manifest from "../config/mobile-store-release.json" with { type: "json" };
export function storeInternalTarget(env) {
  if (env.DOCKED_STORE_INTERNAL !== "true") return null;
  if (
    env.CAPACITOR_PREVIEW_SERVER ||
    env.CAPACITOR_PREVIEW_DEBUGGING === "1" ||
    env.CAPACITOR_LIVE_BETA === "true"
  )
    throw Error("Internal store build cannot use preview overrides");
  if (
    manifest.customerSports.join(",") !== "nfl,afl,nrl" ||
    Object.entries(manifest).some(
      ([k, v]) => k.endsWith("Approved") && v !== false,
    )
  )
    throw Error(
      "Internal test manifest must retain all public and financial gates",
    );
  return Object.freeze({
    mode: "store-internal",
    origin: "https://docked.com.au",
    entryUrl: "https://docked.com.au/app",
    inspect: false,
    cleartext: false,
    webDir: "mobile/generated/store-internal",
    manifest,
  });
}

import { readFileSync } from "node:fs";
export function androidArtifactName(
  kind,
  gradle = readFileSync("android/app/build.gradle", "utf8"),
) {
  const code = Number(gradle.match(/^\s*versionCode\s+(\d+)\s*$/m)?.[1]);
  if (!Number.isSafeInteger(code) || code < 1)
    throw Error("Missing Android version code");
  const label = {
    owner: "NFL-Owner-Connected-QA",
    friends: "NFL-Friends-Beta",
    preview: "Fantasy-Cards-Preview",
  }[kind];
  if (!label) throw Error("Unknown Android delivery channel");
  return `Docked-v${code}-${label}.apk`;
}

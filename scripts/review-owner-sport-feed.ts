import { readFile, stat, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  ownerSportMapping,
  previewOwnerSportFeed,
} from "../src/core/owner-sport-feed";
import { sportEventRules } from "../src/core/sport-event-rules";
import { nbaWeeklyRules } from "../src/core/nba-weekly";

async function readJson(file: string) {
  if ((await stat(file)).size > 2 * 1024 * 1024)
    throw Error("Input exceeds 2 MiB");
  return JSON.parse(await readFile(file, "utf8"));
}
async function main() {
  const [feedFile, mappingFile, reportFile] = process.argv.slice(2);
  if (
    !feedFile ||
    !mappingFile ||
    !reportFile ||
    new Set([feedFile, mappingFile, reportFile].map((f) => resolve(f))).size !==
      3
  )
    throw Error(
      "Usage: tsx scripts/review-owner-sport-feed.ts feed.json mapping.json new-report.json",
    );
  const mapping = ownerSportMapping.parse(await readJson(mappingFile));
  const report = previewOwnerSportFeed(
    await readJson(feedFile),
    mapping,
    mapping.sport === "basketball" &&
      mapping.scoringVersion === "docked-nba-weekly-proposal-v1"
      ? nbaWeeklyRules()
      : sportEventRules(mapping.sport),
    new Date().toISOString(),
  );
  await writeFile(reportFile, JSON.stringify(report, null, 2) + "\n", {
    flag: "wx",
    mode: 0o600,
  });
  console.log(
    JSON.stringify({
      dryRun: true,
      players: report.players.length,
      missing: report.missingPlayerIds.length,
      persisted: false,
    }),
  );
}
main().catch((e) => {
  console.error(e instanceof Error ? e.message : "Feed review failed");
  process.exitCode = 1;
});

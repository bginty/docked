import { writeFile } from "node:fs/promises";
import { z } from "zod";
import {
  rosterCandidate,
  rosterReviewPolicy,
} from "../src/core/sport-roster-review";
import { readinessPackage } from "../src/core/sport-readiness";
import { ownerFeedPermit } from "../src/server/owner-sport-reconcile";
import { canonicalFixtureBatch } from "../src/core/sport-fixture-contract";
import {
  ownerSportFeed,
  ownerSportMapping,
} from "../src/core/owner-sport-feed";
import { aflStats, eplStats } from "../src/core/scoring-v1";
import {
  nrlEventStats,
  nbaStats,
} from "../src/core/additional-sport-statistics";
import {
  sportEventRules,
  sportScoringReferences,
} from "../src/core/sport-event-rules";

async function main() {
  const output = process.argv[2];
  if (!output || process.argv.length !== 3)
    throw Error(
      "Usage: tsx scripts/export-sport-feed-contract.ts new-contract.json",
    );
  const contract = {
    schemaVersion: 1,
    transport: z.toJSONSchema(ownerSportFeed),
    mapping: z.toJSONSchema(ownerSportMapping),
    roster: z.toJSONSchema(rosterCandidate),
    rosterPolicy: z.toJSONSchema(rosterReviewPolicy),
    feedPermit: z.toJSONSchema(ownerFeedPermit),
    releasePackage: z.toJSONSchema(readinessPackage),
    fixtures: z.toJSONSchema(canonicalFixtureBatch),
    sports: Object.entries({
      afl: aflStats,
      nrl: nrlEventStats,
      basketball: nbaStats,
      epl: eplStats,
    }).map(([sport, schema]) => ({
      sport,
      rules: sportEventRules(sport as "afl" | "nrl" | "basketball" | "epl"),
      statistics: z.toJSONSchema(schema),
      reference:
        sportScoringReferences[sport as keyof typeof sportScoringReferences],
    })),
    notes: [
      "No fetching, database writes, competition activation or card issuance.",
      "JSON Schema covers structure; the review command also enforces time order, identities and cross-field validation.",
      "Missing statistics must not be replaced by zero. All fields in a complete statistics row are required.",
      "Names, cities and original colour treatments use the separate reviewed roster contract; never derive identities from display names.",
    ],
  };
  await writeFile(output, JSON.stringify(contract, null, 2) + "\n", {
    flag: "wx",
  });
  console.log("Four sport feed contracts exported; no data imported.");
}
main().catch((e) => {
  console.error(e instanceof Error ? e.message : "Export failed");
  process.exitCode = 1;
});

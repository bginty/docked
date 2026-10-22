import { readFile, stat, writeFile } from "node:fs/promises";
import { rosterReviewReport } from "../src/core/sport-roster-review";
import { previewSportIssuance } from "../src/core/sport-issuance-preview";
import {
  readinessPackage,
  evaluateReadiness,
} from "../src/core/sport-readiness";
import { digest } from "../src/core/scoring-engine";
/** Offline operator preparation. Deliberately no credentials, HTTP, minting or DB. */
async function main() {
  const [mode, input, output] = process.argv.slice(2);
  if (
    !input ||
    !output ||
    !["roster", "issuance", "release"].includes(mode) ||
    process.argv.length !== 5
  )
    throw Error(
      "Usage: tsx scripts/review-sport-activation.ts roster|issuance|release input.json new-report.json",
    );
  if ((await stat(input)).size > 8_000_000) throw Error("Input exceeds 8 MB");
  const data = JSON.parse(await readFile(input, "utf8")),
    now = new Date().toISOString();
  const report =
    mode === "roster"
      ? rosterReviewReport(data.roster, data.policy, now, data.completeTeamIds)
      : mode === "issuance"
        ? previewSportIssuance(
            data.plan,
            data.roster,
            data.policy,
            data.completeTeamIds,
            now,
          )
        : (() => {
            const p = readinessPackage.parse(data);
            const hash = digest(p);
            return {
              packageHash: hash,
              ...evaluateReadiness(p, now, hash),
              package: p,
            };
          })();
  await writeFile(output, JSON.stringify(report, null, 2) + "\n", {
    flag: "wx",
  });
  console.log("Review written. No records changed and no approval inferred.");
}
main().catch((e) => {
  console.error(e instanceof Error ? e.message : "Review failed");
  process.exitCode = 1;
});

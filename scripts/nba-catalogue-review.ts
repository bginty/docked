import { readFileSync, writeFileSync } from "node:fs";
import { reviewNbaCatalogue } from "../src/core/nba-catalogue-review";

const [source, destination] = process.argv.slice(2);
if (!source || !destination)
  throw Error(
    "Usage: tsx scripts/nba-catalogue-review.ts reviewed-input.json new-report.json",
  );
const report = reviewNbaCatalogue(
  JSON.parse(readFileSync(source, "utf8")),
  new Date().toISOString(),
);
writeFileSync(destination, JSON.stringify(report, null, 2) + "\n", {
  flag: "wx",
});
console.log(
  JSON.stringify({
    readyForReview: report.readyForReview,
    quarantined: report.quarantined,
    completeEligibleCoverage: report.completeEligibleCoverage,
    issuanceAllowed: false,
    activationAllowed: false,
  }),
);

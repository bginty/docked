import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { z } from "zod";
import { rosterReviewReport } from "../src/core/sport-roster-review";

// Offline review only. No network, credentials, database or issuance command.
async function main() {
  const [input, output] = process.argv.slice(2);
  if (!input || !output || resolve(input) === resolve(output))
    throw Error(
      "Usage: tsx scripts/review-sport-roster.ts evidence.json new-report.json",
    );
  const raw = await readFile(input, "utf8");
  if (Buffer.byteLength(raw) > 16 * 1024 * 1024)
    throw Error("Evidence file too large");
  const data = z
    .object({
      policy: z.unknown(),
      completeTeamIds: z.array(z.string()),
      candidates: z.array(z.unknown()).max(10000),
    })
    .strict()
    .parse(JSON.parse(raw));
  const report = rosterReviewReport(
    data.candidates,
    data.policy,
    new Date().toISOString(),
    data.completeTeamIds,
  );
  // Do not overwrite prior review evidence.
  await writeFile(output, JSON.stringify(report, null, 2) + "\n", {
    flag: "wx",
  });
  console.log(
    JSON.stringify({
      readyForReview: report.readyForReview,
      quarantined: report.quarantined,
      activationAllowed: false,
      issuanceAllowed: false,
    }),
  );
}
main().catch((e) => {
  console.error(e instanceof Error ? e.message : "Roster review failed");
  process.exitCode = 1;
});

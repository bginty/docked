import { readFileSync, writeFileSync } from "node:fs";
import { planBetaInvitations } from "../src/core/beta-invitation-plan";

// Fixed ignored paths keep tester addresses out of source and console output.
// This is not an invitation sender or an activation command.
try {
  const roster = JSON.parse(
    readFileSync("private-data/production/beta-testers.json", "utf8"),
  );
  const plan = planBetaInvitations(roster);
  writeFileSync(
    "private-data/production/beta-invitation-plan.json",
    JSON.stringify(plan, null, 2) + "\n",
    { mode: 0o600 },
  );
  console.log(
    JSON.stringify({
      status: plan.status,
      testerCount: plan.testers.length,
      emailsSent: 0,
      accountsCreated: 0,
    }),
  );
} catch {
  console.error(
    "Invitation preparation blocked. Supply at most ten unique Australian tester entries in the private roster; exclude the owner and additional fields. No account or message was created.",
  );
  process.exitCode = 1;
}

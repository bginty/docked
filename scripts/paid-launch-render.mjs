/** Offline rendering, always ROLLBACK. Never opens a DB or invokes a provider. */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { paidLaunchSql } from "./lib/paid-launch-configuration.mjs";
const [phase, planFile, outFile] = process.argv.slice(2);
assert(
  ["prepare", "phone", "commerce", "registration", "close"].includes(phase),
);
for (const file of [planFile, outFile])
  assert(
    file &&
      path.resolve(file).startsWith(path.resolve("private-data") + path.sep),
  );
const plan = JSON.parse(fs.readFileSync(planFile));
const ids = JSON.parse(
  fs.readFileSync(
    "docs/qa/final-release-decision-20261117/season-eligibility.json",
  ),
).proposedDefinitionIds;
const sql =
  "-- PREPARED ONLY: defaults to rollback. Exact founder GO, source/config, backup,\n-- live preflight and prior durable external checkpoints are required for execution.\nbegin;\n" +
  paidLaunchSql(phase, plan, ids) +
  "\nrollback;\n";
fs.writeFileSync(outFile, sql, { flag: "wx" });
console.log(
  "Prepared local SQL with ROLLBACK; no connections or external changes.",
);

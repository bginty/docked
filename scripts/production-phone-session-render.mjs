/** Offline private rendering. No network; ROLLBACK remains the default. */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { phoneSessionSql } from "./lib/production-phone-session-sql.mjs";
const [planFile, cohortFile, outFile] = process.argv.slice(2);
for (const f of [planFile, outFile])
  assert(
    f && path.resolve(f).startsWith(path.resolve("private-data") + path.sep),
  );
assert(
  cohortFile &&
    path.resolve(cohortFile).includes(path.sep + "private-data" + path.sep),
);
const plan = JSON.parse(fs.readFileSync(planFile)),
  cohort = JSON.parse(fs.readFileSync(cohortFile));
assert(Array.isArray(cohort));
const owners = cohort.filter(
  (a) => a.kind === "owner" && a.originalRole === "owner",
);
assert.equal(
  owners.length,
  1,
  "Exact original Founder cohort identity required",
);
const tariff = createHash("sha256")
  .update(
    fs.readFileSync(
      "docs/qa/paid-launch-final-20261118/provider-readonly.json",
    ),
  )
  .digest("hex");
fs.writeFileSync(
  outFile,
  "-- PREPARED ONLY. Verify exact approval, private identity, fresh backup/preflight.\nbegin;\n" +
    phoneSessionSql(plan, owners[0].id, tariff) +
    "\nrollback;\n",
  { flag: "wx" },
);
console.log(
  "Private disabled-window SQL rendered with ROLLBACK. No provider calls or sends.",
);

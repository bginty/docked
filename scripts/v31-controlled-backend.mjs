// prepare is read-only/local. stage and promote both require exact founder approval.
import assert from "node:assert/strict";
import {
  readExactPackage,
  requireV31Approval,
} from "./lib/v31-exact-package.mjs";
const mode = process.argv[2];
assert(["prepare", "stage", "promote"].includes(mode));
assert(
  !process.argv.some((a) =>
    ["--fixture-commerce", "--supervised-member-test"].includes(a),
  ),
);
readExactPackage();
if (mode !== "prepare") requireV31Approval(`backend-${mode}`);
const baseline = "f1b50b6f51d7429a36df9a8d5db99aed8886bd44";
assert(
  !process.argv.some((a) => a.startsWith("--baseline=")),
  "Baseline is pinned by reviewed wrapper",
);
process.argv.push(`--baseline=${baseline}`);
process.env.NBA_RELEASE_EVIDENCE =
  "docs/qa/v31-prelaunch-execution-20261111/backend";
process.env.DOCKED_RELEASE_COMMERCIAL_DORMANT = "true";
process.env.DOCKED_V31_DORMANT_RELEASE = "true";
await import("./nba-private-beta-release.mjs");

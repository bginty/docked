// Uses the already installed pinned local PostgreSQL runtime. No Docker, cloud,
// production credential, new service or reset of another local database.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { spawn } from "node:child_process";
import assert from "node:assert/strict";
mkdirSync("tmp", { recursive: true });
mkdirSync("docs/qa/beta-trading/postgres", { recursive: true });
let settlement = readFileSync("scripts/marketplace-postgres.ts", "utf8");
settlement =
  'import {betaTradingConcurrency} from "../scripts/beta-trading-concurrency";\n' +
  settlement.replaceAll(
    "docs/qa/marketplace-operational",
    "docs/qa/beta-trading/postgres",
  );
const marker =
  '    await mkdir("docs/qa/beta-trading/postgres", { recursive: true });';
assert.ok(settlement.includes(marker));
settlement = settlement.replace(
  marker,
  "    checks.push(await betaTradingConcurrency(sql,connections));\n" + marker,
);
writeFileSync("tmp/beta-trading-settlement.ts", settlement);
let runner = readFileSync(
  "scripts/fantasy-production-local-postgres.mjs",
  "utf8",
);
assert.ok(runner.includes('"scripts/marketplace-postgres.ts"'));
runner = runner.replace(
  '"scripts/marketplace-postgres.ts"',
  '"tmp/beta-trading-settlement.ts"',
);
runner = runner.replace(
  'started && process.platform === "win32" && process.argv.includes("--weekly-core")',
  'started && process.platform === "win32"',
);
writeFileSync("tmp/beta-trading-postgres-runner.mjs", runner);
const child = spawn(
  process.execPath,
  ["tmp/beta-trading-postgres-runner.mjs", "--marketplace-phase-one"],
  { stdio: "inherit", windowsHide: true },
);
process.exitCode = await new Promise((done, reject) => {
  child.on("error", reject);
  child.on("exit", (code) => done(code ?? 1));
});

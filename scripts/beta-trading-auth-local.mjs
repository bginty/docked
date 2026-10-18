// Reuses the existing isolated Auth/Postgres harness and its existing images.
// No hosted credentials or assets. Run only after the local Auth service starts.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { spawn } from "node:child_process";
import assert from "node:assert/strict";
mkdirSync("docs/qa/beta-trading/auth", { recursive: true });
if (!process.argv.includes("--prepare-only")) {
  try {
    const r = await fetch("http://127.0.0.1:55341/auth/v1/health", {
      signal: AbortSignal.timeout(3000),
    });
    assert.ok(r.status < 500);
  } catch {
    writeFileSync(
      "docs/qa/beta-trading/auth/status.json",
      JSON.stringify(
        {
          passed: false,
          blocked: true,
          cause:
            "Existing local Auth service at 127.0.0.1:55341 unavailable; Docker Desktop Linux engine was not running",
          hostedMutations: 0,
        },
        null,
        2,
      ),
    );
    console.error(
      "BLOCKED: existing local Auth service at 127.0.0.1:55341 is unavailable. No test or hosted transaction was attempted.",
    );
    process.exit(1);
  }
}
let source = readFileSync("scripts/marketplace-auth-local.ts", "utf8")
  .replaceAll('"./', '"../scripts/')
  .replaceAll("docs/qa/market-overhaul", "docs/qa/beta-trading/auth");
source =
  'import {verifyBetaTradingAuth} from "../scripts/beta-trading-auth-acceptance";\n' +
  source;
const seed = '    stage = "app-start";';
assert.ok(source.includes(seed));
source = source.replace(
  seed,
  `
    await sql.begin(async tx=>{
      await tx\`select pg_advisory_xact_lock(71820342)\`;
      await tx\`update credits_sandbox.trading_control set approval_reference='LOCAL authenticated QA only',approved_at=clock_timestamp(),paused=false,sale=true,swap=true,combined=true where id\`;
      for(const u of qa.users.slice(0,4))await tx\`insert into credits_sandbox.trading_members values(\${u.id},true,'LOCAL authenticated QA only') on conflict(user_id) do update set enabled=true\`;
    });
` + seed,
);
const localFlag =
  '...(socialUpgrade ? { DOCKED_PRIVATE_OFFERS_LOCAL: "true" } : {}),';
assert.ok(source.includes(localFlag));
source = source.replace(
  localFlag,
  'DOCKED_PRIVATE_OFFERS_LOCAL: "false", DOCKED_BETA_TRADING: "private-beta-trading-v1", DOCKED_TEST_MARKET_READ_ONLY: "false",',
);
const acceptance = "      if (marketOverhaul) {";
assert.ok(source.includes(acceptance));
source = source.replace(
  acceptance,
  acceptance +
    "\n        checks.push(await verifyBetaTradingAuth(sql,contexts,qa.users.map((u:any)=>u.id)));",
);
source = source.replace(
  'import("../scripts/market-overhaul-acceptance")',
  'import("./beta-trading-auth-trades")',
);
writeFileSync("tmp/beta-trading-auth-runner.ts", source);
writeFileSync(
  "tmp/beta-trading-auth-trades.ts",
  readFileSync("scripts/market-overhaul-acceptance.ts", "utf8").replaceAll(
    "docs/qa/market-overhaul",
    "docs/qa/beta-trading/auth",
  ),
);
if (process.argv.includes("--prepare-only")) {
  const { transform } = await import("esbuild");
  for (const file of [
    "tmp/beta-trading-auth-runner.ts",
    "tmp/beta-trading-auth-trades.ts",
  ])
    await transform(readFileSync(file, "utf8"), { loader: "ts" });
  console.log(
    "Prepared and syntax-checked isolated Auth harness. No server or database connection.",
  );
  process.exit(0);
}
const child = spawn(
  process.execPath,
  [
    "--import",
    "tsx",
    "tmp/beta-trading-auth-runner.ts",
    "--market-overhaul",
    "--social-only",
    "--receipt=docs/qa/beta-trading/auth/run.json",
  ],
  { stdio: "inherit", windowsHide: true },
);
process.exitCode = await new Promise((done, reject) => {
  child.on("error", reject);
  child.on("exit", (code) => done(code ?? 1));
});

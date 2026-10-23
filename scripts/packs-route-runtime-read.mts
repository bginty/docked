// Read-only operations through the real Production runtime role. No identity
// impersonation, claims, writes or security-function replacements.
import fs from "node:fs/promises";
import { ownerRuntimeDatabase } from "./owner-gameplay-db.mjs";
import { refreshEconomyCatalogue } from "../src/server/economy-catalogue";
import { betaSql } from "../src/server/beta-sql";
import { memberReadIsolation } from "../src/server/member-read-isolation";
import {
  validateCredits,
  type CreditsState,
} from "../src/core/credits-sandbox";
import assert from "node:assert/strict";
const root = process.cwd();
process.chdir("C:/Users/61412/Documents/ChatGPT/Docked.com.au");
const raw = ownerRuntimeDatabase(),
  sql = betaSql(raw),
  checks = [];
try {
  for (const stage of ["catalogue", "trading", "context", "access"]) {
    const started = performance.now();
    await sql.begin(memberReadIsolation, async (tx) => {
      await tx`set local statement_timeout='15s'`;
      if (stage === "catalogue") {
        const state = (
          await tx`select document from credits_sandbox.state where id`
        )[0].document as CreditsState;
        validateCredits(state);
        await refreshEconomyCatalogue(tx, state);
      } else if (stage === "trading") {
        await tx`select credits_sandbox.trading_access(null::uuid,'private-beta-trading-v1') value`;
        assert.equal(
          (await tx`select beta_private.active_member_session() allowed`)[0]
            .allowed,
          false,
        );
      } else if (stage === "context") {
        await tx`select set_config('docked.hosted_preview_project','',true),set_config('docked.nba_private_beta','enabled',true),set_config('docked.multi_sport','isolated-preview',true),set_config('docked.sports_private_beta','enabled',true),set_config('docked.fixture_commerce','enabled',true)`;
      } else {
        await tx`select kind from credits_sandbox.access where enabled and beta_private.admitted(user_id)`;
      }
    });
    checks.push({
      stage,
      passed: true,
      milliseconds: Math.round(performance.now() - started),
    });
  }
} finally {
  await raw.end({ timeout: 3 });
}
await fs.writeFile(
  `${root}/docs/qa/packs-route/runtime-after.json`,
  JSON.stringify(
    { authenticatedMemberTest: false, writes: 0, checks },
    null,
    2,
  ),
);
console.log(checks);

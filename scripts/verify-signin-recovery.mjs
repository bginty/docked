// Restricted runtime role; catalogue reads only, no member identity or commands.
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { ownerRuntimeDatabase } from "./owner-gameplay-db.mjs";
const sql = ownerRuntimeDatabase();
try {
  const checks = [];
  for (const [name, query] of [
    ["jersey", "select id,team,verified_jersey_number from credits_sandbox.current_player_jerseys"],
    ["wallet-catalogue", "select c.*,j.verified_jersey_number from credits_sandbox.current_player_status c left join credits_sandbox.current_player_jerseys j on j.id=c.id"],
  ]) {
    await sql.begin(async tx => {
      await tx`set local statement_timeout='5s'`;
      const start = Date.now();
      const rows = await tx.unsafe(query);
      checks.push({name, rows:rows.length, queryMs:Date.now()-start});
      assert.ok(rows.length > 0);
    });
  }
  const result = {at:new Date().toISOString(),passed:true,checks,scope:"Actual hosted restricted-role SELECTs; not member login or transactional acceptance"};
  writeFileSync("docs/qa/signin-recovery/runtime-queries.json", JSON.stringify(result,null,2));
  console.log(JSON.stringify(result));
} finally {await sql.end();}

// Explicit, reviewed configuration transition. Does not activate weekly packs,
// publish announcements, deliver push, pay prizes or purchase member cards.
import assert from "node:assert/strict";
import type postgres from "postgres";
import { ownerDatabase, projectRef } from "./owner-gameplay-db.mjs";
import { applyPaidPackTransition } from "../src/server/paid-pack-transition";
import { applyWeeklyPrizeTemplates } from "../src/server/weekly-prize-transition";

const args = process.argv.slice(2);
const option = (name: string) =>
  args.find((a) => a.startsWith(`${name}=`))?.split("=")[1];
const apply = args.includes("--apply");
const season = Number(option("--first-season"));
const week = Number(option("--first-week"));
const expectedRevision = Number(option("--expected-revision"));
if (apply) {
  assert.equal(
    option("--project"),
    projectRef,
    "Exact reviewed project required",
  );
  assert.ok(
    Number.isInteger(expectedRevision),
    "Expected economy revision required",
  );
  assert.ok(
    Number.isInteger(season) && season >= 2026,
    "First prize season required",
  );
  assert.ok(
    Number.isInteger(week) && week >= 1 && week <= 30,
    "First prize week required",
  );
}
const sql = ownerDatabase();
try {
  if (!apply) {
    const [row] =
      await sql`select revision,document->'economy'->'activeProductVersions' products from credits_sandbox.state where id`;
    console.log(
      JSON.stringify(
        {
          project: projectRef,
          mode: "read-only",
          ...row,
          weeklyActivation: "separate operation",
        },
        null,
        2,
      ),
    );
  } else {
    const receipt = await sql.begin(async (tx) => {
      await tx`select pg_advisory_xact_lock(71820342)`;
      const [row] =
        await tx`select revision from credits_sandbox.state where id for update`;
      assert.equal(
        Number(row.revision),
        expectedRevision,
        "Economy changed; review the latest state before applying",
      );
      const query = async (s: string, values: unknown[] = []) => ({
        rows: await tx.unsafe(
          s,
          values.map((v) =>
            v !== null && typeof v === "object" ? tx.json(v as postgres.JSONValue) : v,
          ),
        ),
      });
      const catalogue = await applyPaidPackTransition(query);
      const prizes = await applyWeeklyPrizeTemplates(query, season, week);
      return {
        project: projectRef,
        catalogue,
        prizes,
        weeklyActivation: false,
        announcementsPublished: 0,
      };
    });
    console.log(JSON.stringify(receipt, null, 2));
  }
} finally {
  await sql.end();
}

/** Exports only local isolated baseline; never connects to a hosted database. */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { captureSchedulerState } from "./lib/v31-resumed-drift";
import { tableListQuery, checksumQuery } from "./lib/reviewed-inventory";
import {
  writePrivate,
  sourceCommit,
  packageSha256,
} from "./lib/v31-commercial-approval.mjs";
const run = process.argv[2];
assert(["a", "b"].includes(run));
const local = {
  unsafe: async (q: string) =>
    JSON.parse(
      execFileSync(
        "docker",
        [
          "exec",
          "-i",
          "docked-commercial-restore-20261113" + run,
          "psql",
          "-h",
          "/restore",
          "-U",
          "postgres",
          "-d",
          "postgres",
          "-Atq",
        ],
        {
          input: "select coalesce(jsonb_agg(q),'[]') from (" + q + ") q;",
          windowsHide: true,
          maxBuffer: 32e6,
        },
      ).toString(),
    ),
};
async function main() {
  const names = (await local.unsafe(tableListQuery))[0].value;
  const tables: any = {};
  for (let i = 0; i < names.length; i += 40)
    for (const r of await local.unsafe(
      names
        .slice(i, i + 40)
        .map(checksumQuery)
        .join(" union all "),
    )) {
      const { table, ...value } = r.value;
      tables[table] = value;
    }
  const scheduler = await captureSchedulerState(local);
  const notifications = (
    await local.unsafe(
      "select coalesce(jsonb_agg(to_jsonb(t) order by id),'[]') value from credits_sandbox.store_notifications t",
    )
  )[0].value;
  const audit = (
    await local.unsafe(
      "select coalesce(jsonb_agg(to_jsonb(t) order by id),'[]') value from private.audit_events t",
    )
  )[0].value;
  writePrivate("resumed-local-" + run + ".private.json", {
    at: new Date().toISOString(),
    sourceCommit,
    packageSha256,
    tables,
    scheduler,
    notifications,
    audit,
  });
  console.log(
    JSON.stringify({
      localBaseline: run,
      tables: names.length,
      productionWrites: 0,
    }),
  );
}
main().catch((e) => {
  console.error(
    "Isolated baseline stopped: " + String(e.message).slice(0, 180),
  );
  process.exitCode = 1;
});

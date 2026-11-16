import assert from "node:assert/strict";
import test from "node:test";
// @ts-expect-error The actual driver Result implementation has no declaration file.
import Result from "../../node_modules/postgres/src/result.js";
import { persistedSnapshot } from "../../scripts/lib/batch1-production-snapshot.mjs";

test("Postgres Result metadata does not cause false drift against saved JSON", () => {
  const rows = new Result();
  rows.push({ role: "docked_beta_app", superuser: false, bypassRls: false });
  const saved = JSON.parse(JSON.stringify(rows));
  assert.throws(() => assert.deepEqual(rows, saved));
  assert.deepEqual(persistedSnapshot(rows), saved);
});
test("Role elevation, membership and financial changes still fail snapshot equality", () => {
  const baseline = {
    roles: [{ name: "docked_beta_app", superuser: false }],
    memberships: [],
    tables: { wallet: { count: 1, hash: "original" } },
    custodyDigest: "preserved",
  };
  for (const mutate of [
    (v: any) => {
      v.roles[0].superuser = true;
    },
    (v: any) => {
      v.memberships.push({ role: "postgres", member: "docked_beta_app" });
    },
    (v: any) => {
      v.tables.wallet.hash = "changed";
    },
    (v: any) => {
      v.custodyDigest = "changed";
    },
  ]) {
    const altered = persistedSnapshot(baseline);
    mutate(altered);
    assert.throws(() => assert.deepEqual(persistedSnapshot(altered), baseline));
  }
});

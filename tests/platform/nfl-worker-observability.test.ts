import { test } from "node:test";
import assert from "node:assert/strict";
import type { Sql } from "postgres";
import { runNflCollection } from "../../src/server/nfl-collection-worker";

test("idle reconciliation is traceable and never presented as collection success", async () => {
  const updates: unknown[] = [];
  const sql = Object.assign(
    async (parts: TemplateStringsArray, ...args: unknown[]) => {
      const query = parts.join("?");
      if (query.includes("insert into sports_feed.nfl_worker_runs"))
        return [{ id: "fixture" }];
      if (query.includes("update sports_feed.nfl_worker_runs"))
        updates.push(...args);
      return [];
    },
    { json: (value: unknown) => value },
  ) as unknown as Sql;
  const result = await runNflCollection(sql, "reconcile", 2026);
  assert.deepEqual(result, { status: "idle", task: "reconcile", season: 2026 });
  assert.ok(
    updates.some(
      (value) =>
        typeof value === "object" &&
        JSON.stringify(value) === JSON.stringify(result),
    ),
  );
});
test("worker failure retains task/season without putting credentials or raw errors in telemetry", async () => {
  const updates: unknown[] = [];
  const sql = Object.assign(
    async (parts: TemplateStringsArray, ...args: unknown[]) => {
      const query = parts.join("?");
      if (query.includes("insert into sports_feed.nfl_worker_runs"))
        return [{ id: "fixture" }];
      if (query.includes("update sports_feed.nfl_worker_runs")) {
        updates.push(...args);
        return [];
      }
      throw Error("Sensitive database detail fixture");
    },
    { json: (value: unknown) => value },
  ) as unknown as Sql;
  await assert.rejects(
    () => runNflCollection(sql, "reconcile"),
    /collection unavailable/,
  );
  assert.deepEqual(updates[0], {
    error: "SOURCE_OR_CONFIGURATION_UNAVAILABLE",
    stage: "worker",
    diagnostic: "UNCLASSIFIED",
    task: "reconcile",
    season: 2026,
  });
  assert.doesNotMatch(JSON.stringify(updates), /Sensitive/);
});

import test from "node:test";
import assert from "node:assert/strict";
import { drainJobs, isolatedObservation } from "../../src/core/worker-runner";
test("worker drains queued sports in one invocation and respects a hard work bound", async () => {
  let next = 0;
  const handled: number[] = [];
  assert.equal(
    await drainJobs(
      async () => ++next,
      async (job) => {
        handled.push(job);
      },
      3,
    ),
    3,
  );
  assert.deepEqual(handled, [1, 2, 3]);
  assert.equal(
    await drainJobs(
      async () => null,
      async () => {
        throw new Error("no job");
      },
    ),
    0,
  );
});
test("observation failure records an incident and does not prevent independent cleanup", async () => {
  const steps: string[] = [];
  await isolatedObservation(
    async () => {
      throw new Error("source failed");
    },
    async () => {
      steps.push("incident");
    },
  );
  await drainJobs(
    async () => (steps.includes("deleted") ? null : "deletion"),
    async () => {
      steps.push("deleted");
    },
  );
  assert.deepEqual(steps, ["incident", "deleted"]);
});

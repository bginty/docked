import test from "node:test";
import assert from "node:assert/strict";
import { createRefreshQueue } from "../../src/core/refresh-queue";
const tick = () => new Promise<void>((resolve) => setImmediate(resolve));
test("resume burst becomes one read without caching the next refresh", async () => {
  let calls = 0;
  const q = createRefreshQueue(async (current) => {
    calls++;
    assert(current());
  });
  for (let n = 0; n < 20; n++) q.request();
  await tick();
  assert.equal(calls, 1);
  q.request();
  await tick();
  assert.equal(calls, 2);
  q.dispose();
});
test("in-flight purchase invalidation rejects old balance and reads fresh once", async () => {
  const results: number[] = [];
  let calls = 0;
  let release: () => void = () => {};
  const q = createRefreshQueue(async (current) => {
    const call = ++calls;
    if (call === 1) await new Promise<void>((r) => (release = r));
    if (current()) results.push(call);
  });
  q.request();
  await tick();
  q.request();
  q.request();
  release();
  await tick();
  assert.equal(calls, 2);
  assert.deepEqual(results, [2]);
  q.dispose();
});
test("account switch/unmount cancels queued work and rejects previous identity", async () => {
  let release: () => void = () => {};
  let applied = false;
  const q = createRefreshQueue(async (current) => {
    await new Promise<void>((r) => (release = r));
    applied = current();
  });
  q.request();
  await tick();
  q.request();
  q.dispose();
  release();
  await tick();
  assert.equal(applied, false);
  let calls = 0;
  const p = createRefreshQueue(async () => {
    calls++;
  });
  p.request();
  p.dispose();
  await tick();
  assert.equal(calls, 0);
});

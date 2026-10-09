import { test } from "node:test";
import assert from "node:assert/strict";
import { observePublication } from "../../src/core/observations";
import { rules, quotes, now } from "./fixtures";
const input = (at: string) => ({
  rules,
  startAt: "2026-10-02T12:00:00.000Z",
  observedAt: at,
  publishedAt: now,
  selection: "Fictional A",
  bookmaker: "offer",
  minimumOdds: "1.88",
  quotes: quotes(at),
  resolutionSeconds: 300,
});
test("five-minute source never manufactures one-minute availability", () => {
  assert.deepEqual(
    observePublication(input("2026-10-02T06:01:00.000Z"))?.targets,
    [],
  );
  assert.deepEqual(
    observePublication(input("2026-10-02T06:05:00.000Z"))?.targets,
    [5],
  );
  assert.deepEqual(
    observePublication(input("2026-10-02T06:07:00.000Z"))?.targets,
    [],
  );
});
test("availability preserves a below-minimum quote; stale and post-start observations stay missing", () => {
  const i = input("2026-10-02T06:05:00.000Z");
  i.quotes[0].prices["Fictional A"] = "1.80";
  assert.equal(observePublication(i)?.qualifies, false);
  assert.equal(observePublication({ ...i, quotes: quotes(now) }), null);
  assert.equal(observePublication(input("2026-10-02T12:00:00.000Z")), null);
});

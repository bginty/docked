import { test } from "node:test";
import assert from "node:assert/strict";
import {
  providerReadiness,
  freshTimestamp,
  pollBudget,
} from "../../src/core/data-health";
test("missing providers stay NOT_CONFIGURED and unknown/future timestamp never becomes fresh", () => {
  assert.equal(providerReadiness({}, "odds"), "NOT_CONFIGURED");
  assert.equal(providerReadiness({}, "results"), "NOT_CONFIGURED");
  assert.equal(freshTimestamp(null), false);
  assert.equal(freshTimestamp(new Date(Date.now() + 1000)), false);
  assert.equal(freshTimestamp("invalid"), false);
});
test("independent local budget fails closed and preserves unknown provider quota", () => {
  assert.equal(
    pollBudget({ limit: 10, spent: 0, remaining: null, cost: 1 }).allowed,
    true,
  );
  assert.equal(
    pollBudget({ limit: 0, spent: 0, remaining: 100, cost: 1 }).allowed,
    false,
  );
  assert.equal(
    pollBudget({ limit: 10, spent: 10, remaining: 100, cost: 1 }).allowed,
    false,
  );
  assert.equal(
    pollBudget({ limit: 10, spent: 0, remaining: 0, cost: 1 }).allowed,
    false,
  );
});

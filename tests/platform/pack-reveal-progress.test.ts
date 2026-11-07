import test from "node:test";
import assert from "node:assert/strict";
import {
  parseRevealProgress,
  readRevealProgress,
  revealProgressKey,
} from "../../src/core/pack-reveal-progress";
import { revealKey, type PackReceipt } from "../../src/core/pack-opening";

test("resume stores only bounded presentation progress and isolates accounts/receipts", () => {
  const receipt = {
    id: "one",
    cards: [{ id: "a" }, { id: "b" }, { id: "c" }],
  } as PackReceipt;
  assert.notEqual(
    revealProgressKey("one", receipt),
    revealProgressKey("two", receipt),
  );
  assert.notEqual(
    revealProgressKey("one", receipt),
    revealProgressKey("one", { id: "other" }),
  );
  const progress = { index: 1, revealed: true, updatedAt: 123 };
  assert.deepEqual(
    parseRevealProgress(
      JSON.stringify({ ...progress, cards: ["injected"] }),
      3,
    ),
    progress,
  );
  for (const bad of [
    null,
    "garbage",
    "null",
    "0",
    JSON.stringify({ ...progress, index: -1 }),
    JSON.stringify({ ...progress, index: 4 }),
    JSON.stringify({ ...progress, index: 1.5 }),
    JSON.stringify({ ...progress, revealed: "yes" }),
    JSON.stringify({ ...progress, updatedAt: -1 }),
  ])
    assert.equal(parseRevealProgress(bad, 3), null);
  assert.deepEqual(
    parseRevealProgress(JSON.stringify({ ...progress, index: 3 }), 3),
    { ...progress, index: 3, revealed: false },
  );
  assert.equal(
    readRevealProgress(
      {
        getItem: () => {
          throw Error("storage denied");
        },
      },
      "one",
      receipt,
    ),
    null,
  );
  assert.deepEqual(
    readRevealProgress(
      { getItem: (key) => (key === revealKey("one", receipt) ? "2" : null) },
      "one",
      receipt,
    ),
    { index: 2, revealed: false, updatedAt: 0 },
  );
});

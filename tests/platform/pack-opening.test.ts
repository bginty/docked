import { test } from "node:test";
import assert from "node:assert/strict";
import {
  packRevealPreview,
  revealKey,
  revealIndex,
  type PackReceipt,
} from "../../src/core/pack-opening";
test("pack experience never activates on production or by a client flag", () => {
  assert.equal(
    packRevealPreview({
      DOCKED_PACK_REVEAL_PREVIEW: "true",
      VERCEL: "1",
      VERCEL_ENV: "production",
    }),
    false,
  );
  assert.equal(
    packRevealPreview({
      DOCKED_PACK_REVEAL_PREVIEW: "true",
      VERCEL: "1",
      VERCEL_ENV: "preview",
    }),
    true,
  );
  assert.equal(packRevealPreview({ VERCEL_ENV: "preview" }), false);
  assert.equal(
    packRevealPreview({ DOCKED_PACK_REVEAL_PREVIEW: "true", NODE_ENV: "test" }),
    false,
  );
});
test("reveal progress is bounded and separated by user, receipt and awarded card order", () => {
  const receipt = {
    id: "pack",
    cards: [{ id: "a" }, { id: "b" }],
  } as PackReceipt;
  assert.notEqual(revealKey("one", receipt), revealKey("two", receipt));
  assert.notEqual(
    revealKey("one", receipt),
    revealKey("one", { ...receipt, cards: [...receipt.cards].reverse() }),
  );
  for (const raw of ["-1", "1.5", "999", "NaN", '{"cards":["injected"]}'])
    assert.equal(revealIndex(raw, 2), 0);
  assert.equal(revealIndex(null, 2), 0);
  assert.equal(revealIndex("2", 2), 2);
});

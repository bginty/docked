import { test } from "node:test";
import assert from "node:assert/strict";
import { sandboxSelections } from "../../src/core/sport-lineup-view";
import type { SandboxState } from "../../src/core/sport-sandbox";
test("newer private draft survives refresh while confirmed historical entry remains authoritative at lock", () => {
  const entry = {
    competition_id: "round",
    revision: 1,
    user_id: "owner",
    updated_at: "2099-01-01T00:00:00Z",
    snapshot: [{ slot: "FLEX1", card_id: "original" }],
  } as SandboxState["entries"][number];
  const draft = {
    competition_id: "round",
    revision: 2,
    updated_at: "2099-01-01T00:00:01Z",
    selections: [{ slot: "FLEX1", card: "replacement" }],
  };
  assert.deepEqual(sandboxSelections(entry, draft, false), draft.selections);
  assert.deepEqual(sandboxSelections(entry, draft, true), [
    { slot: "FLEX1", card: "original" },
  ]);
  assert.deepEqual(
    sandboxSelections(
      { ...entry, updated_at: "2099-01-01T00:00:02Z" },
      draft,
      false,
    ),
    [{ slot: "FLEX1", card: "original" }],
  );
  assert.deepEqual(
    sandboxSelections(undefined, draft, false),
    draft.selections,
  );
});

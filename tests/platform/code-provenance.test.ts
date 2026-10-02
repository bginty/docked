import { test } from "node:test";
import assert from "node:assert/strict";
import {
  deployedCodeCommit,
  frozenCodeMatches,
} from "../../src/core/code-provenance";
test("prospective strategy execution requires the exact frozen deployed commit", () => {
  const frozen = "a".repeat(40),
    other = "b".repeat(40);
  assert.equal(frozenCodeMatches(frozen, { DOCKED_CODE_COMMIT: frozen }), true);
  assert.equal(
    frozenCodeMatches(frozen, { VERCEL: "1", VERCEL_GIT_COMMIT_SHA: frozen }),
    true,
  );
  assert.equal(frozenCodeMatches(frozen, { DOCKED_CODE_COMMIT: other }), false);
  assert.equal(frozenCodeMatches(frozen, {}), false);
  assert.equal(
    frozenCodeMatches(undefined, { DOCKED_CODE_COMMIT: frozen }),
    false,
  );
  assert.equal(
    frozenCodeMatches(frozen, { DOCKED_CODE_COMMIT: frozen.slice(0, 7) }),
    false,
  );
  assert.equal(
    frozenCodeMatches(frozen, { DOCKED_CODE_COMMIT: "x".repeat(40) }),
    false,
  );
  assert.equal(
    frozenCodeMatches(frozen, { VERCEL: "1", DOCKED_CODE_COMMIT: frozen }),
    false,
  );
  assert.equal(
    frozenCodeMatches(frozen, {
      DOCKED_CODE_COMMIT: other,
      VERCEL_GIT_COMMIT_SHA: frozen,
    }),
    false,
  );
  assert.equal(
    deployedCodeCommit({ DOCKED_CODE_COMMIT: frozen.toUpperCase() }),
    frozen,
  );
});

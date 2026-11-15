import test from "node:test";
import assert from "node:assert/strict";
import {
  packOpeningError,
  PackOpeningError,
  packOpeningMessages,
} from "../../src/core/pack-opening-error";

test("only allowlisted pack failure codes become user-facing opening errors", () => {
  for (const code of Object.keys(packOpeningMessages)) {
    const error = packOpeningError(code);
    assert(error instanceof PackOpeningError);
    assert.equal(
      error.message,
      packOpeningMessages[code as keyof typeof packOpeningMessages],
    );
  }
  for (const untrusted of [
    null,
    {},
    "constructor",
    "__proto__",
    "password=private",
    "WEEKLY_POOL_UNAVAILABLE private",
  ])
    assert.equal(packOpeningError(untrusted), null);
});

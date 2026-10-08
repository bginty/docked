import { test } from "node:test";
import assert from "node:assert/strict";
import {
  fantasyFailureOutcome,
  fantasyResponseRejects,
} from "../../src/core/fantasy-response";
import { fantasyRetry } from "../../src/core/fantasy-request";
test("uncertain transaction or response errors retain the same retry identity", () => {
  const first = fantasyRetry(
    null,
    "claim_daily",
    {},
    () => "authored-stable-request",
  );
  for (const error of [
    new Error("Connection lost after COMMIT"),
    { code: "ECONNRESET" },
    { code: "ETIMEDOUT" },
    { code: "08006" },
    { code: "57P01" },
    new TypeError("Response serialization failed"),
    undefined,
  ]) {
    const response = fantasyFailureOutcome(error);
    assert.equal(response.status, 503);
    assert.equal(response.outcome, "unconfirmed");
    assert.equal(fantasyResponseRejects(response.status, response), false);
    assert.equal(
      fantasyRetry(first, "claim_daily", {}, () => "must-not-change"),
      first,
    );
  }
});
test("only explicit authoritative rejection allows a new operation", () => {
  for (const code of ["P0001", "23514", "23505", "40001", "40P01", "42501"]) {
    const response = fantasyFailureOutcome({ code });
    assert.equal(response.status, 409);
    assert.equal(fantasyResponseRejects(response.status, response), true);
  }
  for (const [status, body] of [
    [409, { error: "legacy generic error" }],
    [503, { outcome: "rejected" }],
    [502, null],
    [200, { outcome: "rejected" }],
    [401, {}],
  ] as const)
    assert.equal(fantasyResponseRejects(status, body), false);
});

test("a rejected retry cannot resolve an earlier ambiguous commit or receipt replay", () => {
  const request = fantasyRetry(
    null,
    "open_pack",
    { pack_id: "authored-pack" },
    () => "original-key",
  );
  let uncertain = false;
  for (const error of [
    { code: "ECONNRESET" },
    { code: "40001" },
    { code: "P0001" },
    { code: "42501" },
  ]) {
    const response = fantasyFailureOutcome(error);
    assert.equal(
      fantasyResponseRejects(response.status, response, uncertain),
      false,
    );
    uncertain = true;
    assert.equal(
      fantasyRetry(
        request,
        "open_pack",
        { pack_id: "authored-pack" },
        () => "must-not-regenerate",
      ),
      request,
    );
  }
  assert.equal(
    fantasyResponseRejects(409, { outcome: "rejected" }, false),
    true,
  );
  assert.equal(
    fantasyResponseRejects(409, { outcome: "rejected" }, true),
    false,
  );
});

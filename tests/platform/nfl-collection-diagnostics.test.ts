import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CollectionFailure,
  collectionDiagnostic,
  collectionFailureDetail,
} from "../../src/server/nfl-collection-diagnostics";
test("source diagnostics are bounded codes, not raw error or credential text", () => {
  assert.equal(
    collectionDiagnostic(new Error("NFL source HTTP 403")),
    "NFL_SOURCE_HTTP_403",
  );
  assert.equal(
    collectionDiagnostic(new Error("NFL source HTTP 403 secret")),
    "UNCLASSIFIED",
  );
  assert.equal(
    collectionDiagnostic(
      Object.assign(new Error("private SQL"), { code: "42501" }),
    ),
    "DATABASE_PERMISSION_DENIED",
  );
  assert.equal(
    collectionDiagnostic(new Error("Buffer is not defined")),
    "RUNTIME_BUFFER_UNAVAILABLE",
  );
  assert.deepEqual(
    collectionFailureDetail(new CollectionFailure("fetch", "SOURCE_TIMEOUT")),
    { stage: "fetch", diagnostic: "SOURCE_TIMEOUT" },
  );
  assert.doesNotMatch(
    JSON.stringify(collectionFailureDetail(new Error("password=private"))),
    /password|private/,
  );
});

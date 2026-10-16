import { test } from "node:test";
import assert from "node:assert/strict";
import { adminRecordInput } from "../../src/core/admin-record";

test("record lookup rejects cross-role categories and bounds exact IDs and history pages", () => {
  assert.deepEqual(
    adminRecordInput(
      { category: "cards", record: "a&b", historyPage: "2" },
      "auditor",
    ),
    { category: "cards", id: "a&b", page: 2 },
  );
  for (const role of ["admin", "auditor", "analyst", "editor", "member", ""]) {
    assert.throws(
      () =>
        adminRecordInput({ category: "transactions", record: "journal" }, role),
      /Category denied/,
    );
  }
  for (const record of ["", " ", "x".repeat(161), "id\nsecret"])
    assert.throws(
      () => adminRecordInput({ category: "cards", record }, "owner"),
      /Invalid record/,
    );
  for (const historyPage of ["0", "101", "1.5", "NaN"])
    assert.throws(
      () =>
        adminRecordInput(
          { category: "cards", record: "id", historyPage },
          "owner",
        ),
      /Invalid record page/,
    );
  assert.throws(() =>
    adminRecordInput({ category: "members", record: "id" }, "analyst"),
  );
});

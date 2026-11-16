import test from "node:test";
import assert from "node:assert/strict";
import {
  verifyPreviewNamespaces,
  type PreviewNamespace,
} from "../../scripts/lib/batch1-preview-schema";
const before: PreviewNamespace[] = [
  { oid: 11, nspname: "pg_catalog", nspowner: 10, acl: "catalog-acl" },
  { oid: 2200, nspname: "public", nspowner: 10, acl: "original-acl" },
];
const created = {
  oid: 4000,
  nspname: "b1_acceptance",
  nspowner: 20,
  acl: "isolated",
};
const temp = { oid: 5000, nspname: "pg_temp_42", nspowner: 10, acl: "" };
const toast = { oid: 5001, nspname: "pg_toast_temp_42", nspowner: 10, acl: "" };
test("new session temporary schemas do not masquerade as changes to existing ACLs", () => {
  const result = verifyPreviewNamespaces(
    before,
    [...before, created, temp, toast],
    [created.nspname],
    temp.oid,
  );
  assert.equal(result.existingNamespaces, 2);
  assert.equal(result.reviewedNamespaces, 1);
  assert.equal(result.sessionTemporaryNamespaces.length, 2);
});
test("existing namespace removal, rename, owner and privilege changes all fail", () => {
  for (const change of [
    { acl: "weakened" },
    { nspowner: 999 },
    { nspname: "renamed" },
  ])
    assert.throws(() =>
      verifyPreviewNamespaces(
        before,
        [before[0], { ...before[1], ...change }, created],
        [created.nspname],
        0,
      ),
    );
  assert.throws(() =>
    verifyPreviewNamespaces(before, [before[0], created], [created.nspname], 0),
  );
});
test("other backend or unreviewed namespace creation is rejected", () => {
  for (const extra of [
    { oid: 5002, nspname: "pg_temp_99", nspowner: 10, acl: "" },
    { oid: 5003, nspname: "surprise", nspowner: 20, acl: "" },
  ])
    assert.throws(() =>
      verifyPreviewNamespaces(
        before,
        [...before, created, temp, toast, extra],
        [created.nspname],
        temp.oid,
      ),
    );
  assert.throws(() =>
    verifyPreviewNamespaces(
      before,
      [...before, created, temp, toast],
      [created.nspname],
      created.oid,
    ),
  );
  assert.throws(() =>
    verifyPreviewNamespaces(
      before,
      [...before, temp, toast],
      [created.nspname],
      temp.oid,
    ),
  );
});
test("existing temporary schemas must also remain unchanged", () => {
  const initial = [...before, temp, toast];
  assert.deepEqual(
    verifyPreviewNamespaces(
      initial,
      [...initial, created],
      [created.nspname],
      temp.oid,
    ).sessionTemporaryNamespaces,
    [],
  );
  assert.throws(() =>
    verifyPreviewNamespaces(
      initial,
      [...before, { ...temp, acl: "unexpected" }, toast, created],
      [created.nspname],
      temp.oid,
    ),
  );
});

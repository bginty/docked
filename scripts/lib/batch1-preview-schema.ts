import assert from "node:assert/strict";
export type PreviewNamespace = {
  oid: number;
  nspname: string;
  nspowner: number;
  acl: string;
};
/** Preserve every existing namespace. Permit only reviewed additions and this
 * backend's own PostgreSQL temporary namespace pair used by the approved fixture. */
export function verifyPreviewNamespaces(
  before: readonly PreviewNamespace[],
  after: readonly PreviewNamespace[],
  approved: readonly string[],
  tempOid: number,
) {
  const previous = new Map(before.map((n) => [n.oid, n]));
  const current = new Map(after.map((n) => [n.oid, n]));
  assert.equal(current.size, after.length, "Duplicate namespace OID");
  for (const n of before)
    assert.deepEqual(
      current.get(n.oid),
      n,
      "Existing namespace changed: " + n.nspname,
    );
  const additions = after.filter((n) => !previous.has(n.oid));
  for (const name of approved) {
    assert(/^b1_[a-z_]+$/.test(name));
    assert.equal(
      additions.filter((n) => n.nspname === name).length,
      1,
      "Reviewed namespace not created: " + name,
    );
  }
  const temporary = new Set<number>();
  if (tempOid) {
    const own = current.get(tempOid);
    assert(own, "Session temporary namespace missing");
    const suffix = own.nspname.match(/^pg_temp_(\d+)$/)?.[1];
    assert(suffix, "Invalid session temporary namespace");
    assert.equal(own.acl, "", "Unexpected temporary namespace privileges");
    temporary.add(own.oid);
    const toast = after.find((n) => n.nspname === "pg_toast_temp_" + suffix);
    if (toast) {
      assert.equal(toast.nspowner, own.nspowner);
      assert.equal(toast.acl, "");
      temporary.add(toast.oid);
    }
  }
  for (const n of additions)
    assert(
      approved.includes(n.nspname) || temporary.has(n.oid),
      "Unreviewed namespace created: " + n.nspname,
    );
  return {
    existingNamespaces: before.length,
    reviewedNamespaces: approved.length,
    sessionTemporaryNamespaces: additions
      .filter((n) => temporary.has(n.oid))
      .map((n) => n.nspname),
  };
}

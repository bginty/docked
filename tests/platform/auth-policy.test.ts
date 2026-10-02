import { test } from "node:test";
import assert from "node:assert/strict";
import {
  staffAllowed,
  verifiedSessionClaims,
} from "../../src/core/auth-policy";
test("staff capability matrix isolates editors, analysts and read-only auditors and requires MFA", () => {
  assert.equal(staffAllowed("auditor", "aal2", "read_operations"), true);
  for (const op of [
    "publish",
    "edit_article",
    "strategy_transition",
    "correct_settlement",
  ] as const)
    assert.equal(staffAllowed("auditor", "aal2", op), false);
  assert.equal(staffAllowed("editor", "aal2", "publish"), false);
  assert.equal(staffAllowed("editor", "aal2", "edit_article"), true);
  assert.equal(staffAllowed("analyst", "aal2", "publish"), true);
  assert.equal(staffAllowed("analyst", "aal2", "strategy_transition"), false);
  for (const role of ["owner", "admin", "analyst", "editor", "auditor"])
    assert.equal(staffAllowed(role, "aal1", "read_operations"), false);
});
test("verified-token claim parser refuses wrong subject, malformed session and unsupported assurance", () => {
  const uid = "00000000-0000-4000-8000-000000000001",
    sid = "00000000-0000-4000-8000-000000000002";
  const token = (value: unknown) =>
    `unused.${Buffer.from(JSON.stringify(value)).toString("base64url")}.already-verified-elsewhere`;
  assert.deepEqual(
    verifiedSessionClaims(
      token({ sub: uid, session_id: sid, aal: "aal2" }),
      uid,
    ),
    { sessionId: sid, aal: "aal2" },
  );
  assert.equal(
    verifiedSessionClaims(
      token({ sub: sid, session_id: sid, aal: "aal2" }),
      uid,
    ),
    null,
  );
  assert.equal(
    verifiedSessionClaims(
      token({ sub: uid, session_id: "bad", aal: "aal2" }),
      uid,
    ),
    null,
  );
  assert.equal(
    verifiedSessionClaims(
      token({ sub: uid, session_id: sid, aal: "admin" }),
      uid,
    ),
    null,
  );
  assert.equal(verifiedSessionClaims("invalid", uid), null);
});

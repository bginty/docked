import {
  ownerDatabase,
  ownerRuntimeDatabase,
  projectRef,
} from "./owner-gameplay-db.mjs";
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
const admin = ownerDatabase(),
  app = ownerRuntimeDatabase();
try {
  const row = (
    await admin`select c.owner_id,s.id session from beta_private.owner_gameplay_control c join auth.sessions s on s.user_id=c.owner_id where c.enabled and s.aal='aal2' and (s.not_after is null or s.not_after>clock_timestamp()) order by s.created_at desc limit 1`
  )[0];
  assert.ok(row);
  const checks = [];
  for (const aal of ["aal1", "aal2"]) {
    const allowed = await app.begin(async (tx) => {
      await tx`select set_config('request.jwt.claim.sub',${row.owner_id},true),set_config('request.jwt.claims',${JSON.stringify({ sub: row.owner_id, session_id: row.session, aal })},true)`;
      return (await tx`select beta_private.active_member_session() allowed`)[0]
        .allowed;
    });
    assert.equal(allowed, aal === "aal2");
    checks.push({ role: "existing owner", aal, allowed });
  }
  const gate = (
    await admin`select tester_id is null tester_empty,tester_enabled from beta_private.two_person_control where id`
  )[0];
  assert.equal(gate.tester_empty, true);
  assert.equal(gate.tester_enabled, false);
  const report = {
    at: new Date().toISOString(),
    projectRef,
    scope:
      "Hosted restricted runtime read-only DB checks, not a browser sign-in or forged auth token",
    passed: true,
    checks,
    testerSlotEmpty: true,
  };
  writeFileSync(
    "docs/qa/two-person-beta/hosted-mfa-db.json",
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(JSON.stringify(report));
} finally {
  await app.end({ timeout: 5 });
  await admin.end({ timeout: 5 });
}

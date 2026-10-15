// Read-only release verification. Never uses a member session or changes admission.
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { ownerDatabase, projectRef } from "./owner-gameplay-db.mjs";
const sql = ownerDatabase();
try {
  const rows = await sql`
    select case lower(u.email)
      when 'support@docked.com.au' then 'Owner'
      when 'barrydearing@gmail.com' then 'Barry'
      when 'lbickley89@gmail.com' then 'Luke' end as tester,
      u.email_confirmed_at is not null as confirmed,
      beta_private.admitted(u.id) as admitted,
      beta_private.beta_gameplay_identity(u.id) as gameplay,
      beta_private.gameplay_mfa_required(u.id) as mfa_required,
      exists(select 1 from credits_sandbox.access a where a.user_id=u.id and a.enabled) as wallet
    from auth.users u
    where lower(u.email) in ('support@docked.com.au','barrydearing@gmail.com','lbickley89@gmail.com')`;
  assert.equal(rows.length, 3);
  for (const r of rows) {
    assert.ok(r.confirmed && r.admitted && r.gameplay && r.wallet);
    assert.equal(r.mfa_required, r.tester === "Owner");
  }
  const result = {
    at: new Date().toISOString(), projectRef, passed: true, testers: rows,
    scope: "Read-only account/admission/MFA-policy verification; not interactive login or hosted transactional acceptance",
    invitationsRequired: false, invitationsSent: 0, memberMutations: 0,
  };
  writeFileSync("docs/qa/private-beta-release/admission.json", JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
} finally { await sql.end(); }

import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
const dir = "private-data/clean-transition-20261117",
  plan = JSON.parse(readFileSync(dir + "/plan.private.json")),
  manifest = JSON.parse(readFileSync(dir + "/manifest.private.json"));
const q = (s) => "'" + s.replaceAll("'", "''") + "'";
const run = (s) =>
  execFileSync(
    "docker",
    [
      "exec",
      "-i",
      "docked-commercial-restore-20261117b",
      "psql",
      "-h",
      "/restore",
      "-U",
      "postgres",
      "-X",
      "-qAt",
      "-v",
      "ON_ERROR_STOP=1",
    ],
    {
      input: s,
      encoding: "utf8",
      windowsHide: true,
      maxBuffer: 4 * 1024 * 1024,
    },
  );
const checks = [
  "select beta_private.owner_health_gate()",
  "select beta_private.require_privacy_owner()",
  "select beta_private.sport_readiness_owner()",
  "select beta_private.credit_request_owner()",
  "select beta_private.moderation_case_role()",
  "select beta_private.admin_search('unmatched-clean-test','all',1)",
  "select credits_sandbox.trading_report()",
  "select beta_fantasy.admin_prizes()",
  "select beta_private.owner_command_centre(now()-interval '1 day',now(),null,true)",
  "select operations.review('read')",
];
let sql =
  "begin;\n" +
  readFileSync(
    "supabase/migrations/20261117001019_clean_commercial_account_transition.sql",
    "utf8",
  ) +
  "\n" +
  readFileSync(
    "config/operations/clean-commercial-transition.prepared.sql",
    "utf8",
  ) +
  `\nselect launch_transition.prepare(${q(JSON.stringify(manifest))}::jsonb,launch_transition.source_digest(),repeat('a',64),repeat('b',64));\n`;
for (const a of plan.accounts.filter((a) => a.kind === "owner")) {
  sql +=
    `select set_config('request.jwt.claim.sub',${q(a.id)},true),set_config('request.jwt.claims',jsonb_build_object('sub',${q(a.id)},'session_id',(select id from auth.sessions where user_id=${q(a.id)}::uuid and aal='aal2'and(not_after is null or not_after>now())limit 1),'aal','aal2')::text,true);\n` +
    checks.join(";\n") +
    ";\n" +
    `savepoint owner_consent_permissions;
set local role docked_app;
select p.id from public.profiles p join private.roles r on r.user_id=p.id and r.role='owner' join private.runtime_auth_users u on u.id=p.id join private.runtime_auth_sessions s on s.user_id=u.id where p.id=${q(a.id)}::uuid and s.id::text=current_setting('request.jwt.claims',true)::jsonb->>'session_id' and(private.commercial_transition_status(p.id)->>'betaEnded')::boolean for update of p;
update public.profiles set age_attested=true,accepted_version='isolated-explicit-consent-fixture' where id=${q(a.id)}::uuid;
insert into private.consent_events(user_id,purpose,granted,version,actor)values(${q(a.id)}::uuid,'privacy',true,'isolated-explicit-consent-fixture',${q(a.id)});
insert into private.social_profiles(user_id,handle,display_name)values(${q(a.id)}::uuid,'isolated_owner_consent','Isolated Owner');
rollback to savepoint owner_consent_permissions;
`;
}
sql += "rollback;";
try {
  run(sql);
  const result = {
    at: new Date().toISOString(),
    owners: 2,
    checksPerOwner: checks,
    restrictedPublicRoleConsentWritesRehearsedAndRolledBack: true,
    passed: true,
    productionWrites: 0,
    allChangesRolledBack: true,
  };
  writeFileSync(
    "docs/qa/clean-transition-20261117/owner-surface-tests.json",
    JSON.stringify(result, null, 2) + "\n",
  );
  console.log(
    JSON.stringify({ owners: 2, checksPerOwner: checks.length, passed: true }),
  );
} catch (e) {
  writeFileSync(dir + "/owner-error.private.txt", String(e.stderr));
  console.error(String(e.stderr));
  process.exitCode = 1;
}

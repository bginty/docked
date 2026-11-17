/** Network-disabled restored database only; every scenario rolls back. */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { paidLaunchSql } from "./lib/paid-launch-configuration.mjs";
const target = "docked-commercial-restore-20261117i";
const info = JSON.parse(
  execFileSync("docker", ["inspect", target], {
    encoding: "utf8",
    windowsHide: true,
  }),
)[0];
assert.equal(info.HostConfig.NetworkMode, "none");
assert.equal(Object.keys(info.HostConfig.PortBindings ?? {}).length, 0);
assert(info.HostConfig.Tmpfs["/restore"]);
const run = (sql) =>
  execFileSync(
    "docker",
    [
      "exec",
      "-i",
      target,
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
    { input: sql, encoding: "utf8", windowsHide: true, maxBuffer: 4e6 },
  ).trim();
const ids = JSON.parse(
  readFileSync(
    "docs/qa/final-release-decision-20261117/season-eligibility.json",
  ),
).proposedDefinitionIds;
const p = {
  version: 1,
  projectRef: "pojoymtniryarxxunyvz",
  approvalSha256: "a".repeat(64),
  smsEvidenceSha256: "b".repeat(64),
  googleEvidenceSha256: "c".repeat(64),
  terms: "2026-11-17-commercial-paid-launch-v2",
  privacy: "2026-11-17-privacy-clean-launch-v5",
  windowId: "isolated-paid-launch",
  publicBudgetAudCents: 5000,
  reservationAudCents: 100,
  startsAt: new Date(Date.now() - 60000).toISOString(),
  until: new Date(Date.now() + 604000000).toISOString(),
};
const before = run("select launch_transition.source_digest();");
const guard = (body) => `do $check$ begin ${body} end $check$;`;
const checks = [];
function expectFailure(label, sql, expected) {
  let failed = false;
  try {
    run("begin;" + sql + "rollback;");
  } catch (e) {
    failed = String(e.stderr).includes(expected);
  }
  assert(failed, label);
  checks.push({ label, passed: true });
}
expectFailure(
  "commerce before preparation denied",
  paidLaunchSql("commerce", p, ids),
  "Exact prepared launch checkpoint required",
);
expectFailure(
  "registration before paid fulfilment denied",
  paidLaunchSql("registration", p, ids),
  "Exact prepared launch checkpoint required",
);
const prepare = paidLaunchSql("prepare", p, ids);
expectFailure(
  "duplicate preparation fails safely",
  prepare + prepare,
  "Phase already recorded",
);
expectFailure(
  "registration with SMS closed denied",
  prepare +
    paidLaunchSql("commerce", p, ids) +
    paidLaunchSql("registration", p, ids),
  "Paid fulfilment and funded SMS must precede registration",
);
let sql =
  "begin;" +
  `
create temp table protected_defs as select id,to_jsonb(d)-'approved' data from commercial_billing.definitions d;
create temp table protected_rounds as select to_jsonb(r) data from public_gameplay.rounds r;
create temp table protected_assets as select launch_transition.source_digest() digest;
` +
  prepare +
  paidLaunchSql("commerce", p, ids) +
  paidLaunchSql("phone", p, ids) +
  paidLaunchSql("registration", p, ids) +
  guard(`
 if not public_gameplay.signup_allowed('AU','NSW',${"'" + p.terms + "'"},${"'" + p.privacy + "'"}) then raise exception 'AU signup policy missing';end if;
 if public_gameplay.signup_allowed('US','CA',${"'" + p.terms + "'"},${"'" + p.privacy + "'"}) or public_gameplay.signup_allowed('AU','NSW','old-terms',${"'" + p.privacy + "'"}) then raise exception 'Eligibility bypass';end if;
 if exists(select 1 from commercial_billing.definitions d join protected_defs b using(id) where to_jsonb(d)-'approved'<>b.data) then raise exception 'Permanent definition changed';end if;
 if exists((select to_jsonb(r) from public_gameplay.rounds r) except(select data from protected_rounds)) then raise exception 'Round changed';end if;
 if exists(select 1 from launch_transition.accounts where kind<>'owner' and launch_transition.identity_allowed(user_id)) then raise exception 'Retired/QA allowed';end if;
 if exists(select 1 from commercial_billing.cards) or exists(select 1 from commercial_billing.packs) or exists(select 1 from commercial_billing.lots where remaining>0) then raise exception 'Inherited commercial assets';end if;
`) +
  `
select jsonb_build_object('eligible',(select count(*) from commercial_billing.definitions where approved),'excluded',(select count(*) from commercial_billing.definitions where not approved),'lifetime',(select sum(issued) from commercial_billing.definitions),'roundsEnabled',(select count(*) from public_gameplay.rounds where enabled),'cards',(select count(*) from commercial_billing.cards),'smsAttempts',(select count(*) from sms_delivery.attempts));
` +
  paidLaunchSql("close", p, ids) +
  guard(`
 if exists(select 1 from commercial_billing.control where sales_enabled or issuance_enabled or transfers_enabled or gameplay_enabled) or exists(select 1 from sms_delivery.windows where enabled) or exists(select 1 from private.feature_flags where enabled) then raise exception 'Emergency closure incomplete';end if;
`) +
  "rollback;";
const output = run(sql);
assert.equal(run("select launch_transition.source_digest();"), before);
checks.push({
  label:
    "ordered prepare/commerce/SMS/registration and emergency close; unchanged supply and zero assets; rollback",
  passed: true,
});
mkdirSync("docs/qa/paid-launch-final-20261118", { recursive: true });
const report = {
  at: new Date().toISOString(),
  passed: true,
  network: "none",
  hosted: false,
  productionWrites: 0,
  smsSent: 0,
  purchases: 0,
  sourceDigestUnchanged: true,
  checks,
  observations: output
    .split("\n")
    .filter((s) => s.startsWith("{"))
    .map(JSON.parse),
};
writeFileSync(
  "docs/qa/paid-launch-final-20261118/activation-rehearsal.json",
  JSON.stringify(report, null, 2) + "\n",
);
console.log(JSON.stringify(report));

// Supervised support-only owner bootstrap. Never scheduled or shipped to the web.
// Deliberately one attempt: a persisted marker blocks replay after any uncertainty.
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { randomBytes, randomUUID, createHash } from "node:crypto";
import postgres from "postgres";
import { databaseConnectionOptions } from "../src/server/database-tls.ts";
import { dispatchOnce } from "./owner-mail-dispatch.mjs";
import { flags, secrets, checkFlags } from "./owner-mail-window.mjs";

const serviceBaseFix =
  process.argv[2] === "--send-owner-invite-after-service-base-fix";
const quotaRecovery = process.argv[2] === "--send-owner-invite-after-quota";
const reviewedFix =
  serviceBaseFix ||
  process.argv[2] === "--send-owner-invite-after-site-url-fix";
assert.ok(process.argv[2] === "--send-owner-invite-once" || reviewedFix || quotaRecovery);
const root = "private-data/production/";
const receiptFile =
  root +
  "owner-window/" +
  (quotaRecovery
    ? "invite-after-quota.json"
    : serviceBaseFix
    ? "invite-after-service-base-fix.json"
    : reviewedFix
      ? "invite-after-site-url-fix.json"
      : "invite-attempt.json");
const approvalFile = root + "microsoft365/owner-dispatch-approval.json";
const read = (path) => JSON.parse(readFileSync(path, "utf8"));
let authority = "Owner supervised authentication approval after 281e372c";
if (quotaRecovery) {
  const approvalPath = root + "owner-window/quota-recovery-approval.json";
  assert.ok(existsSync(approvalPath), "Fresh explicit owner approval required; no request sent");
  const approval = read(approvalPath);
  assert.equal(approval.approved, true);
  assert.equal(approval.projectRef, "pojoymtniryarxxunyvz");
  assert.equal(approval.recipient, "support@docked.com.au");
  assert.equal(approval.deploymentId, "dpl_5fADFGCKB9LGuwMLxjjE1cqjVZ4y");
  assert.equal(approval.maximumInvitations, 1);
  assert.equal(typeof approval.ownerMessageReference, "string");
  assert.ok(approval.ownerMessageReference.trim().length > 10);
  const age = Date.now() - Date.parse(approval.approvedAt);
  assert.ok(age >= 0 && age < 5 * 60_000, "Approval must be given immediately before sending");
  const quota = read("docs/qa/owner-acceptance/owner-quota-confirmation.json");
  assert.ok(Date.now() >= Date.parse(quota.earliestConservativeRecheckAt));
  const prior = read(root + "owner-window/invite-after-service-base-fix.json");
  assert.equal(prior.inviteStatus, 429);
  assert.equal(prior.emailsAccepted, 0);
  assert.equal(prior.dispatch, undefined);
  assert.equal(prior.finalDatabase.users, 0);
  assert.equal(prior.finalDatabase.outstanding_mail, 0);
  assert.equal(prior.dispatcherDisabled, true);
  authority = approval.ownerMessageReference;
}
if (reviewedFix) {
  // Explicit operator reconciliation after a reviewed compatibility fix, never
  // an automatic HTTP retry or a retry of a dispatched/uncertain Graph send.
  const prior = read(
    root +
      "owner-window/" +
      (serviceBaseFix
        ? "invite-after-site-url-fix.json"
        : "invite-attempt.json"),
  );
  assert.equal(prior.inviteStatus, 500);
  assert.equal(prior.emailsAccepted, 0);
  assert.equal(prior.dispatch, undefined);
  assert.equal(prior.finalDatabase.users, 0);
  assert.equal(prior.finalDatabase.outstanding_mail, 0);
  assert.equal(prior.dispatcherDisabled, true);
  writeFileSync(
    "docs/qa/owner-acceptance/" +
      (serviceBaseFix
        ? "project-root-invitation-rejected.json"
        : "initial-invitation-rejected.json"),
    JSON.stringify(prior, null, 2) + "\n",
  );
}
if (serviceBaseFix) {
  const probe = read("docs/qa/owner-acceptance/provider-no-send-probe.json");
  assert.equal(probe.senderEnabled, false);
  assert.equal(probe.workerEnabled, false);
  assert.equal(probe.allMailFlagsClosed, true);
  assert.equal(probe.hookStatus, 503);
  assert.equal(probe.productionMailRows, 0);
  assert.equal(probe.authUsers, 0);
}
const ref = "pojoymtniryarxxunyvz",
  email = "support@docked.com.au";
const connection = read(root + "connection.json");
assert.equal(connection.projectRef, ref);
assert.equal(connection.organizationId, "otldyeunbqabbcjydjpe");
const deployment = read("docs/qa/beta-isolation/deployment-status.json");
if (quotaRecovery)
  assert.equal(deployment.id, "dpl_5fADFGCKB9LGuwMLxjjE1cqjVZ4y");
const preflight = read("docs/qa/owner-acceptance/supervised-preflight.json");
assert.equal(deployment.effectiveTarget, "preview");
assert.equal(deployment.state, "READY");
assert.equal(deployment.project, "prj_l0rpVDPRuIRp9UcBUkudeyUK5yST");
assert.equal(preflight.deploymentId, deployment.id);
assert.equal(preflight.allPassed, true);
assert.ok(Date.now() - Date.parse(preflight.checkedAt) < 30 * 60_000);
assert.equal(
  existsSync(receiptFile),
  false,
  "Existing attempt: reconcile, never resend automatically",
);
const manifest = read("config/hosted-beta.json");
assert.equal(manifest.ownerAcceptanceApproved, true);
assert.equal(manifest.externalActivationApproved, false);
const grantAudit = read(
  "docs/qa/fantasy-production/graph-application-preflight.json",
);
assert.equal(grantAudit.certificate.matchesPrivateKey, true);
assert.equal(grantAudit.effectiveGrantAudit.complete, true);
assert.deepEqual(grantAudit.effectiveGrantAudit.assignments, []);
assert.deepEqual(grantAudit.token.observedClaims.roles, []);
assert.ok(Date.now() - Date.parse(grantAudit.checkedAt) < 60 * 60_000);
const before = secrets();
checkFlags(before, false);
const url = new URL(
  readFileSync(
    root + "provider-config/supabase/.temp/pooler-url",
    "utf8",
  ).trim(),
);
assert.equal(url.username, "postgres." + ref);
url.password = read(root + "provision-request.json").databasePassword;
const sql = postgres(url.href, {
  ...databaseConnectionOptions(url.href, {
    DATABASE_SSL_CA_FILE: resolve("certs/supabase-prod-ca-2021.crt"),
  }),
  max: 1,
  onnotice: () => {},
});
const report = {
  checkedAt: new Date().toISOString(),
  deploymentId: deployment.id,
  url: deployment.url,
  project: ref,
  recipient: email,
  authority,
  emailsRequested: 0,
  emailsAccepted: 0,
  deliveryVerified: false,
  mfaEnrolled: false,
  administratorRoleGranted: false,
  reconciledSiteUrlFailure: reviewedFix,
};
let flagsAttempted = false;
try {
  const state = (
    await sql`select (select count(*)::int from auth.users) users, (select count(*)::int from beta_private.admissions) admissions, (select count(*)::int from cron.job) jobs, to_regnamespace('net') is not null net, (select enabled from private.docked_mail_scheduler) scheduled, (select enabled or testers_enabled from beta_private.admission_control) admission_enabled, (select count(*)::int from private.docked_auth_mail_outbox where state in ('pending','authorizing','dispatching')) pending`
  )[0];
  assert.deepEqual(
    { ...state },
    {
      users: 0,
      admissions: 0,
      jobs: 0,
      net: false,
      scheduled: false,
      admission_enabled: false,
      pending: 0,
    },
  );
  const settings = await fetch(connection.supabaseUrl + "/auth/v1/settings", {
    headers: { apikey: connection.publishableKey },
    redirect: "error",
    signal: AbortSignal.timeout(15000),
  });
  assert.equal(settings.status, 200);
  const auth = await settings.json();
  assert.equal(auth.disable_signup, true);
  assert.equal(auth.mailer_autoconfirm, false);
  const token = randomBytes(32).toString("hex"),
    requestId = randomUUID();
  writeFileSync(
    receiptFile,
    JSON.stringify({
      phase: "attempt-reserved",
      requestId,
      at: new Date().toISOString(),
      recipient: email,
      deploymentId: deployment.id,
    }),
    { flag: "wx", mode: 0o600 },
  );
  // Minimum temporary changes. Closing in finally is mandatory even if enable fails.
  flagsAttempted = true;
  flags(true, deployment.url);
  const approval = {
    enabled: true,
    projectRef: ref,
    recipient: email,
    serverRecipientMode: "support-test",
    queueReviewed: true,
    ownerApprovalReference: report.authority,
    expiresAt: new Date(Date.now() + 10 * 60_000).toISOString(),
  };
  writeFileSync(approvalFile, JSON.stringify(approval), { mode: 0o600 });
  report.emailsRequested = 1;
  const response = await fetch(
    connection.supabaseUrl +
      "/auth/v1/invite?redirect_to=" +
      encodeURIComponent(deployment.url + "/auth/callback?next=/app/verified"),
    {
      method: "POST",
      redirect: "error",
      signal: AbortSignal.timeout(20000),
      headers: {
        apikey: connection.secretKey,
        Authorization: "Bearer " + connection.secretKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, data: {} }),
    },
  );
  report.inviteStatus = response.status;
  const result = await response.json();
  if (response.status !== 200)
    report.inviteErrorCode = result.code ?? result.error_code ?? "unavailable";
  assert.equal(
    response.status,
    200,
    "Invitation request outcome requires reconciliation",
  );
  const user = result.user ?? result;
  assert.equal(user.email?.toLowerCase(), email);
  assert.match(user.id, /^[0-9a-f-]{36}$/);
  report.ownerId = user.id;
  // Reservation grants no profile, consent, MFA, role, card, points or gameplay.
  await sql.begin(async (tx) => {
    const users = await tx`select id,email,email_confirmed_at from auth.users`;
    assert.equal(users.length, 1);
    assert.equal(users[0].id, user.id);
    assert.equal(users[0].email, email);
    assert.equal(users[0].email_confirmed_at, null);
    await tx`update beta_private.admission_control set enabled=true,testers_enabled=false,policy_digest=${manifest.policyApproval.digest},policy_versions=${tx.json(manifest.policyApproval.versions)},approved_by=${report.authority},approved_at=clock_timestamp() where id`;
    await tx`insert into beta_private.designated_administrators(user_id,designated_by) values(${user.id},${report.authority})`;
    const a =
      await tx`select beta_private.reserve_admission(${email},${user.id},${createHash("sha256").update(token).digest("hex")},${requestId},clock_timestamp()+interval '1 day',${report.authority}) id`;
    report.admissionId = a[0].id;
  });
  writeFileSync(
    root + "owner-window/owner-admission-code.txt",
    "Docked owner-only beta admission code\nUse only at " +
      deployment.url +
      "/app/invitation-setup after confirming your emailed invitation.\n\n" +
      token +
      "\n\nExpires one day after reservation. Do not share or paste into chat.\n",
    { mode: 0o600 },
  );
  const queued =
    await sql`select id,state from private.docked_auth_mail_outbox where mode='production'`;
  assert.equal(queued.length, 1);
  assert.equal(queued[0].state, "pending");
  report.mailReceiptId = queued[0].id;
  const secret = readFileSync(
    root + "microsoft365/hook-disabled.env",
    "utf8",
  ).match(/SEND_EMAIL_HOOK_SECRET="(v1,whsec_[^"]+)"/)[1];
  report.dispatch = await dispatchOnce({ approval, secret });
  const outcome = (
    await sql`select state,attempts,last_code from private.docked_auth_mail_outbox where id=${queued[0].id}`
  )[0];
  report.queueOutcome = outcome;
  report.emailsAccepted = outcome.state === "accepted" ? 1 : 0;
  assert.equal(
    outcome.state,
    "accepted",
    "Sending outcome requires operator reconciliation; no retry",
  );
  assert.equal(outcome.attempts, 1);
  report.status = "AWAITING_OWNER_INBOX_AND_CONFIRMATION";
} catch {
  report.status = "BLOCKED_RECONCILE_NO_RETRY";
  process.exitCode = 1;
} finally {
  try {
    if (flagsAttempted) flags(false);
    writeFileSync(
      approvalFile,
      JSON.stringify({ enabled: false, closedAt: new Date().toISOString() }),
    );
    report.dispatcherDisabled = true;
    const after = secrets();
    for (const row of before.filter((r) =>
      /^(GRAPH_|SEND_EMAIL_HOOK_SECRET|SUPABASE_)/.test(r.name),
    ))
      assert.equal(after.find((r) => r.name === row.name)?.value, row.value);
    report.credentialsUnchanged = true;
  } catch {
    report.dispatcherDisabled = false;
    report.shutdownRequiresAttention = true;
    process.exitCode = 1;
  }
  report.finalDatabase = (
    await sql`select (select count(*)::int from auth.users) users,(select count(*)::int from auth.mfa_factors) mfa_factors,(select testers_enabled from beta_private.admission_control) testers_enabled,(select count(*)::int from beta_private.roles) beta_roles,(select count(*)::int from cron.job) cron_jobs,to_regnamespace('net') is not null net_schema,(select count(*)::int from private.docked_auth_mail_outbox where state in ('pending','authorizing','dispatching')) outstanding_mail`
  )[0];
  await sql.end({ timeout: 5 });
  writeFileSync(
    "docs/qa/owner-acceptance/supervised-invitation.json",
    JSON.stringify(report, null, 2) + "\n",
  );
  if (existsSync(receiptFile))
    writeFileSync(receiptFile, JSON.stringify(report, null, 2), {
      mode: 0o600,
    });
  console.log(JSON.stringify(report));
}

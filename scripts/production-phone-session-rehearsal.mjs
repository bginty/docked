/** Existing fresh restored snapshot only. No network, identifiers or SMS output. */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import { createHash } from "node:crypto";
import { phoneSessionSql } from "./lib/production-phone-session-sql.mjs";
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
    {
      input: sql,
      encoding: "utf8",
      windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"],
    },
  ).trim();
try {
  const cohort = JSON.parse(
    fs.readFileSync(
      "C:/Users/61412/.codex/worktrees/batch1-pack-phone-20261116/Docked.com.au/private-data/clean-transition-20261117/manifest.private.json",
    ),
  );
  const owners = cohort.filter(
    (a) => a.kind === "owner" && a.originalRole === "owner",
  );
  assert.equal(owners.length, 1);
  const founder = owners[0].id,
    hash = (x) => createHash("sha256").update(x).digest("hex");
  const p = {
    version: 1,
    projectRef: "pojoymtniryarxxunyvz",
    organizationId: "otldyeunbqabbcjydjpe",
    sourceCommit: "a".repeat(40),
    approvalSha256: "b".repeat(64),
    founderIdentitySha256: hash(founder),
    windowId: "isolated-one-founder",
    maximumAttempts: 1,
    maximumReservedAudCents: 100,
    attended: true,
    signupEnabled: false,
    startsAt: new Date(Date.now() - 30000).toISOString(),
    until: new Date(Date.now() + 7100000).toISOString(),
  };
  const before = run("select launch_transition.source_digest();");
  const prepare = phoneSessionSql(p, founder, "c".repeat(64));
  let rejected = false;
  try {
    run("begin;" + prepare + prepare + "rollback;");
  } catch (e) {
    rejected = String(e.stderr).includes("Window already exists");
  }
  assert(rejected, "Duplicate session must not replenish");
  run(
    "begin;" +
      prepare +
      `do $check$ declare u uuid; begin
 if sms_delivery.reserve('${p.windowId}','${"1".repeat(64)}','${founder}')<>'denied' then raise exception 'Disabled window sent';end if;
 update sms_delivery.windows set enabled=true where id='${p.windowId}';
 for u in select user_id from launch_transition.accounts where user_id<>'${founder}'::uuid loop
 if sms_delivery.reserve('${p.windowId}','${"2".repeat(64)}',u)<>'denied' then raise exception 'Non-Founder allowed';end if;end loop;
 if sms_delivery.reserve('${p.windowId}','${"3".repeat(64)}','${founder}')<>'send' then raise exception 'Founder reservation failed';end if;
 if sms_delivery.reserve('${p.windowId}','${"3".repeat(64)}','${founder}')<>'pending' then raise exception 'Duplicate reservation changed';end if;
 if sms_delivery.reserve('${p.windowId}','${"4".repeat(64)}','${founder}')<>'denied' then raise exception 'Second attempt permitted';end if;
 perform sms_delivery.finish('${p.windowId}','${"3".repeat(64)}',false);
 if (select reserved_aud_cents from sms_delivery.windows where id='${p.windowId}')<>100 or (select count(*) from sms_delivery.attempts where window_id='${p.windowId}')<>1 then raise exception 'Bound exceeded';end if;
 update sms_delivery.windows set enabled=false where id='${p.windowId}';
 if sms_delivery.reserve('${p.windowId}','${"3".repeat(64)}','${founder}')<>'denied' then raise exception 'Closed window allowed';end if;
 if not exists(select 1 from sms_delivery.attempts where window_id='${p.windowId}' and state='uncertain') then raise exception 'Failed attempt history lost';end if;
 end $check$;rollback;`,
  );
  assert.equal(run("select launch_transition.source_digest();"), before);
  assert.equal(
    run(
      "select count(*) from sms_delivery.windows where id='isolated-one-founder';",
    ),
    "0",
  );
  const result = {
    at: new Date().toISOString(),
    passed: true,
    isolatedRestore: true,
    network: "none",
    hosted: false,
    productionWrites: 0,
    smsSent: 0,
    checks: [
      "exact retained Owner with verified MFA",
      "disabled window denies",
      "all five other cohort identities denied",
      "one 100-cent reservation",
      "duplicate returns saved pending state",
      "second attempt denied",
      "provider failure keeps reservation and history",
      "closure denies even duplicate",
      "duplicate preparation cannot replenish",
      "rollback removes synthetic window and source digest unchanged",
    ],
  };
  fs.writeFileSync(
    "docs/qa/paid-launch-final-20261118/phone-session-rehearsal.json",
    JSON.stringify(result, null, 2) + "\n",
  );
  console.log(JSON.stringify(result));
} catch {
  console.error(
    "Isolated one-attempt rehearsal failed; no provider calls and no private SQL emitted.",
  );
  process.exitCode = 1;
}

// Read-only external preflight. Never sends mail, changes Auth, DNS or admission.
import {
  mkdirSync,
  readFileSync,
  writeFileSync,
  existsSync,
  copyFileSync,
} from "node:fs";
import { spawnSync, execFileSync } from "node:child_process";
import { resolve } from "node:path";
import {
  resolve4,
  resolveCname,
  resolveMx,
  resolveNs,
  resolveTxt,
} from "node:dns/promises";
import assert from "node:assert/strict";
import { ownerDatabase, projectRef } from "./owner-gameplay-db.mjs";
const privateDir = "private-data/friends-cutover";
const out = "docs/qa/friends-cutover";
mkdirSync(privateDir, { recursive: true });
mkdirSync(privateDir + "/supabase", { recursive: true });
if (!existsSync(privateDir + "/supabase/config.toml"))
  copyFileSync("supabase/config.toml", privateDir + "/supabase/config.toml");
mkdirSync(out, { recursive: true });
const report = {
  at: new Date().toISOString(),
  projectRef,
  readOnly: true,
  commit: execFileSync("git", ["rev-parse", "HEAD"], {
    encoding: "utf8",
  }).trim(),
  changes: 0,
  messagesSent: 0,
  checks: {},
};
const pulled = spawnSync(
  process.execPath,
  [
    "node_modules/supabase/dist/supabase.js",
    "config",
    "pull",
    "--yes",
    "--force",
    "--project-ref",
    projectRef,
    "--workdir",
    privateDir,
  ],
  { encoding: "utf8", windowsHide: true, timeout: 60000 },
);
writeFileSync(
  privateDir + "/auth-pull.log",
  String(pulled.stdout) + String(pulled.stderr),
);
assert.equal(pulled.status, 0, "Config pull failed; private log retained");
const text = readFileSync(privateDir + "/supabase/config.toml", "utf8");
if (!existsSync(privateDir + "/auth-before.toml"))
  copyFileSync(
    privateDir + "/supabase/config.toml",
    privateDir + "/auth-before.toml",
  );
const section = (name) =>
  text.split("[" + name + "]")[1]?.split(/^\[/m)[0] ?? "";
const value = (name, key) => {
  const found = section(name).match(
    new RegExp("^" + key + " = (.+)$", "m"),
  )?.[1];
  try {
    return JSON.parse(found);
  } catch {
    return null;
  }
};
report.checks.auth = {
  siteUrl: value("auth", "site_url"),
  redirects: value("auth", "additional_redirect_urls"),
  publicSignup: value("auth", "enable_signup"),
  emailConfirmation: value("auth.email", "enable_confirmations"),
  emailHookEnabled: value("auth.hook.send_email", "enabled"),
  emailHookUri: value("auth.hook.send_email", "uri"),
};
const dns = {};
for (const [name, getter] of [
  ["apexA", () => resolve4("docked.com.au")],
  ["wwwCname", () => resolveCname("www.docked.com.au")],
  ["mx", () => resolveMx("docked.com.au")],
  ["nameservers", () => resolveNs("docked.com.au")],
  ["txt", () => resolveTxt("docked.com.au")],
]) {
  try {
    dns[name] = await getter();
  } catch (e) {
    dns[name] = { error: e.code };
  }
}
if (!existsSync(privateDir + "/dns-before.json"))
  writeFileSync(privateDir + "/dns-before.json", JSON.stringify(dns, null, 2));
writeFileSync(privateDir + "/dns-latest.json", JSON.stringify(dns, null, 2));
report.checks.dns = {
  apexA: dns.apexA,
  wwwCname: dns.wwwCname,
  mx: dns.mx,
  nameservers: dns.nameservers,
  fullPreimage: privateDir + "/dns-before.json",
};
const sql = ownerDatabase();
try {
  report.checks.admission = (
    await sql`select
    (select enabled from beta_private.friends_control where id) friends_enabled,
    (select testers_enabled from beta_private.admission_control where id) testers_enabled,
    (select count(*)::int from beta_private.friends_roster) lifetime_testers,
    (select enabled from beta_fantasy.swap_policy where id) swaps_enabled,
    (select count(*)::int from sports_feed.nfl_allocations) nfl_grants`
  )[0];
  report.checks.workerRuns =
    await sql`select started_at,finished_at,status,detail from sports_feed.nfl_worker_runs order by started_at desc limit 12`;
  report.checks.cooldowns =
    await sql`select resource,checked_at,next_attempt,error_code from sports_feed.postgame_cache`;
  report.checks.rounds =
    await sql`select stream_id,purpose,locked_at,last_checked,next_check,issues from sports_feed.nfl_rounds order by stream_id`;
  report.checks.mailDispatch = (
    await sql`select
    (select enabled from private.docked_mail_scheduler where singleton) enabled,
    (select count(*)::int from private.docked_auth_mail_outbox where state in ('pending','authorizing','dispatching')) pending,
    (select count(*)::int from vault.secrets where name='docked_auth_email_hook_existing') scheduler_signing_entries,
    (select count(*)::int from cron.job where command like '%private.docked_mail_tick()%') scheduler_jobs`
  )[0];
} finally {
  await sql.end();
}
for (const origin of ["https://docked.com.au", "https://www.docked.com.au"]) {
  const r = await fetch(origin, {
    redirect: "manual",
    signal: AbortSignal.timeout(20000),
  });
  report.checks[origin] = {
    status: r.status,
    redirect: r.headers.get("location"),
  };
}
report.friendsAccessible = false; // This preflight does not certify activation.
report.remaining = [
  "Fresh scheduled source retrieval after cooldown",
  "Versioned friends policy/runtime activation after technical checks",
  "Domain cutover and real domain Auth/gameplay acceptance",
  "Domain-connected APK",
];
writeFileSync(
  resolve(out, "preflight.json"),
  JSON.stringify(report, null, 2) + "\n",
);
console.log(JSON.stringify(report, null, 2));

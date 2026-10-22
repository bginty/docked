import { readFile, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
import postgres from "postgres";
const root = process.argv[2];
assert(root);
const c = JSON.parse(
  await readFile(
    root + "/private-data/private-preview-release/runtime.private.json",
    "utf8",
  ),
);
assert.equal(c.projectRef, "bckkllmndoxzpzdqrevb");
const u = new URL(c.databaseUrl);
assert.equal(decodeURIComponent(u.username), "docked_beta_app." + c.projectRef);
assert(u.hostname.endsWith(".pooler.supabase.com"));
assert.equal(u.port, "5432");
const db = postgres(c.databaseUrl, {
  max: 1,
  prepare: false,
  connect_timeout: 12,
  onnotice: () => {},
  ssl: {
    rejectUnauthorized: true,
    ca: await readFile(root + "/certs/supabase-prod-ca-2021.crt", "utf8"),
  },
});
const report = {
  project: c.projectRef,
  production: false,
  role: "docked_beta_app",
  passed: false,
  denials: [],
  authenticatedJourney: false,
};
try {
  assert.equal(
    (await db`select current_user as role`)[0].role,
    "docked_beta_app",
  );
  for (const [label, q] of [
    ["raw auth records", "select * from auth.users limit 0"],
    ["raw scoring journal", "select * from scoring_beta.journal limit 0"],
    [
      "unverified sandbox access",
      "select sports_feed.sport_sandbox_state('basketball')",
    ],
    ["unverified NBA scores", "select sports_feed.sandbox_nba_journals()"],
    [
      "admission mutation",
      "update beta_private.admission_control set enabled=true where false",
    ],
  ]) {
    let denied = false;
    try {
      await db.unsafe(q);
    } catch (e) {
      assert(["42501", "P0001"].includes(e.code));
      denied = true;
    }
    assert(denied, label + " must fail closed");
    report.denials.push(label);
  }
  report.passed = true;
} catch (e) {
  report.code = e.code ?? "SECURITY_RECONCILIATION_REQUIRED";
  process.exitCode = 1;
} finally {
  await db.end({ timeout: 2 });
  await writeFile(
    "docs/qa/multi-sport/nba-acceptance/hosted-security.json",
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report));
}

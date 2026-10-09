import { writeFileSync, mkdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
const ref = "pojoymtniryarxxunyvz",
  root = "private-data/production/owner-window";
mkdirSync(root, { recursive: true });
export const digest = (s) => createHash("sha256").update(s).digest("hex");
export function cli(args, label) {
  const r = spawnSync(
    process.execPath,
    ["node_modules/supabase/dist/supabase.js", ...args, "--project-ref", ref],
    { encoding: "utf8", timeout: 60000, windowsHide: true },
  );
  writeFileSync(
    root + "/" + label + ".json",
    JSON.stringify({ status: r.status, stdout: r.stdout, stderr: r.stderr }),
    { mode: 0o600 },
  );
  assert.equal(
    r.status,
    0,
    "Scoped CLI failed; inspect private " + label + " diagnostic",
  );
  return r.stdout;
}
export function secrets() {
  return JSON.parse(cli(["secrets", "list", "--output", "json"], "digests"));
}
export function checkFlags(rows, enabled, origin) {
  for (const k of [
    "DOCKED_GRAPH_MAIL_ENABLED",
    "DOCKED_GRAPH_WORKER_READY",
    "DOCKED_GRAPH_INVITES_READY",
  ]) {
    const value = rows.find((x) => x.name === k)?.value;
    if (!enabled && k === "DOCKED_GRAPH_INVITES_READY" && value === undefined)
      continue;
    assert.equal(value, digest(String(enabled)), k);
  }
  assert.equal(
    rows.find((x) => x.name === "DOCKED_GRAPH_TEST_ENABLED")?.value,
    digest("false"),
  );
  const recipient = rows.find(
    (x) => x.name === "DOCKED_GRAPH_RECIPIENT_MODE",
  )?.value;
  if (enabled || recipient !== undefined)
    assert.equal(recipient, digest("support-test"));
  if (origin)
    assert.equal(
      rows.find((x) => x.name === "DOCKED_BETA_AUTH_ORIGIN")?.value,
      digest(origin),
    );
}
export function flags(enabled, origin) {
  const args = [
    "secrets",
    "set",
    ...[
      "DOCKED_GRAPH_MAIL_ENABLED",
      "DOCKED_GRAPH_WORKER_READY",
      "DOCKED_GRAPH_INVITES_READY",
    ].map((k) => k + "=" + enabled),
    "DOCKED_GRAPH_TEST_ENABLED=false",
    "DOCKED_GRAPH_RECIPIENT_MODE=support-test",
  ];
  if (origin) args.push("DOCKED_BETA_AUTH_ORIGIN=" + origin);
  cli(args, enabled ? "enable" : "disable");
  checkFlags(secrets(), enabled, origin);
}
if (process.argv[1]?.replaceAll("\\", "/").endsWith("/owner-mail-window.mjs")) {
  const mode = process.argv[2];
  if (mode === "--close") {
    flags(false);
    writeFileSync(
      "private-data/production/microsoft365/owner-dispatch-approval.json",
      JSON.stringify({ enabled: false, closedAt: new Date().toISOString() }),
    );
    console.log(JSON.stringify({ closed: true }));
  } else if (mode === "--inspect") {
    const s = secrets();
    checkFlags(s, false);
    writeFileSync(root + "/baseline-digests.json", JSON.stringify(s));
    console.log(JSON.stringify({ closed: true, names: s.map((x) => x.name) }));
  } else throw Error("Use --inspect or --close");
}

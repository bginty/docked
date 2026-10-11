// Fresh local export prevents stale retired routes from surviving prior QA builds.
// No .env files or cloud credentials enter the export or child environment.
import { execFileSync, spawn } from "node:child_process";
import {
  copyFileSync,
  mkdirSync,
  symlinkSync,
  openSync,
  writeFileSync,
} from "node:fs";
import { resolve, dirname, sep } from "node:path";
import assert from "node:assert/strict";
const target = resolve("tmp/friends-verification", String(Date.now()));
assert.ok(target.startsWith(resolve("tmp/friends-verification") + sep));
mkdirSync(target, { recursive: true });
const tracked = execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" });
const added = execFileSync(
  "git",
  ["ls-files", "--others", "--exclude-standard", "-z"],
  { encoding: "utf8" },
);
const allowed = (file) =>
  /^(src|public|config|certs)\//.test(file) ||
  [
    "package.json",
    "package-lock.json",
    "next.config.ts",
    "next-env.d.ts",
    "tsconfig.json",
  ].includes(file);
const files = [
  ...new Set((tracked + added).split("\0").filter(Boolean).filter(allowed)),
];
for (const file of files) {
  const dest = resolve(target, file);
  assert.ok(dest.startsWith(target + sep));
  mkdirSync(dirname(dest), { recursive: true });
  copyFileSync(file, dest);
}
symlinkSync(resolve("node_modules"), target + "/node_modules", "junction");
const env = Object.fromEntries(
  Object.entries(process.env).filter(([key]) =>
    /^(PATH|PATHEXT|SYSTEMROOT|WINDIR|TEMP|TMP|USERPROFILE|LOCALAPPDATA|APPDATA|COMSPEC|PROGRAMFILES|PROGRAMFILES\(X86\)|SYSTEMDRIVE|HOMEDRIVE|HOMEPATH)$/i.test(
      key,
    ),
  ),
);
Object.assign(env, {
  NODE_ENV: "production",
  APP_ENV: "preview",
  SUPABASE_ENV: "preview",
  DEMO_MODE: "false",
  SITE_URL: "http://localhost:3000",
  NEXT_TELEMETRY_DISABLED: "1",
});
mkdirSync("private-data/friends-cutover", { recursive: true });
const log = openSync("private-data/friends-cutover/web-build.log", "w");
const child = spawn(
  process.execPath,
  [resolve("node_modules/next/dist/bin/next"), "build"],
  { cwd: target, env, stdio: ["ignore", log, log], windowsHide: true },
);
const status = await new Promise((done, reject) => {
  child.on("error", reject);
  child.on("close", done);
});
const report = {
  at: new Date().toISOString(),
  status,
  files: files.length,
  export: target,
  scope:
    "Production compilation in a fresh credential-free local export, not hosted gameplay or acceptance",
};
mkdirSync("docs/qa/friends-cutover", { recursive: true });
writeFileSync(
  "docs/qa/friends-cutover/web-build.json",
  JSON.stringify(report, null, 2) + "\n",
);
console.log(JSON.stringify(report));
process.exitCode = status ?? 1;

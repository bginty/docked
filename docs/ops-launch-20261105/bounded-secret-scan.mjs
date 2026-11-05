import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
const git = (args) => {
  const r = spawnSync("git", args, { encoding: "utf8" });
  if (r.status !== 0) throw new Error("Git inventory unavailable");
  return r.stdout.split("\0").filter(Boolean);
};
const files = [
  ...new Set([
    ...git([
      "ls-files",
      "--others",
      "--exclude-standard",
      "-z",
      "docs",
      "scripts",
      "src",
      "tests",
      "config",
    ]),
    ...git([
      "diff",
      "--name-only",
      "--diff-filter=ACM",
      "-z",
      "--",
      "docs",
      "scripts",
      "src",
      "tests",
      "config",
    ]),
  ]),
].sort();
const checks = [
  [
    "private-key",
    /-----BEGIN (?:RSA |EC |OPENSSH |ENCRYPTED )?PRIVATE KEY-----/g,
  ],
  ["jwt", /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g],
  ["supabase-secret", /\b(?:sb_secret_|sbp_)[A-Za-z0-9_-]{20,}\b/g],
  ["google-api-key", /\bAIza[A-Za-z0-9_-]{30,}\b/g],
  ["cloud-access-key", /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g],
  ["postgres-password-url", /postgres(?:ql)?:\/\/[^\s:/]+:[^\s@/]{6,}@/g],
  ["bearer-token", /Bearer\s+(?:eyJ[A-Za-z0-9_.-]{25,}|[A-Za-z0-9_-]{40,})/g],
  [
    "secret-url-query",
    /[?&](?:access_token|refresh_token|token_hash|x-vercel-protection-bypass)=[A-Za-z0-9_.-]{20,}/g,
  ],
];
const findings = [];
let inspected = 0;
const skipped = [];
for (const file of files) {
  if (
    file.endsWith("bounded-secret-scan.mjs") ||
    file.endsWith("bounded-secret-scan.json")
  )
    continue;
  const stat = fs.statSync(file);
  if (
    !/\.(?:md|txt|json|csv|log|patch|mjs|ts|tsx|ps1|yml|yaml)$/i.test(file) ||
    stat.size > 2_000_000
  ) {
    skipped.push({
      file,
      reason: "binary/unrecognised type or over 2MB; not content-inspected",
    });
    continue;
  }
  const text = fs.readFileSync(file, "utf8");
  inspected++;
  for (const [kind, pattern] of checks) {
    pattern.lastIndex = 0;
    for (const match of text.matchAll(pattern)) {
      findings.push({
        file: path.posix.normalize(file.replaceAll("\\", "/")),
        line: text.slice(0, match.index).split("\n").length,
        kind,
      });
    }
  }
}
const result = {
  checkedAt: new Date().toISOString(),
  scope:
    "Modified and untracked textual docs/scripts/src/tests/config only; exact patterns; no matches printed; not a claim to OCR screenshots or detect all secret formats",
  inspected,
  findings,
  skipped,
};
fs.writeFileSync(
  "docs/ops-launch-20261105/bounded-secret-scan.json",
  JSON.stringify(result, null, 2) + "\n",
);
console.log(JSON.stringify(result, null, 2));
if (findings.length) process.exitCode = 1;

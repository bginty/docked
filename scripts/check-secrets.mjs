import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";

// Reports filenames only: never echo a matching secret into logs.
const files = [
  ...new Set(
    execFileSync(
      "git",
      ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
      { encoding: "utf8" },
    )
      .split("\0")
      .filter(Boolean),
  ),
];
const patterns = [
  /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/,
  /\bAKIA[A-Z0-9]{16}\b/,
  /\b(?:ghp|gho|ghu|ghs|github_pat)_[A-Za-z0-9_]{30,}\b/,
  /\bsk_(?:live|test)_[A-Za-z0-9]{20,}\b/,
  /\bsb_secret_[A-Za-z0-9_-]{20,}\b/,
  /\beyJ[A-Za-z0-9_-]{15,}\.eyJ[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{20,}\b/,
  /(?:postgres(?:ql)?):\/\/[^\s:'"/]+:[^\s'"/@]{8,}@/,
];
let inspected = 0;
const findings = [];
for (const file of files) {
  if (/(?:^|\/)\.env(?:\.[^/]+)?$/.test(file) && !file.endsWith(".example"))
    findings.push({ file, issue: "tracked environment file" });
  if (
    !/\.(?:tsx?|m?js|json|sql|md|yml|yaml|toml|html|css|txt|example)$/.test(
      file,
    ) ||
    file === "scripts/check-secrets.mjs"
  )
    continue;
  const source = await readFile(file, "utf8");
  inspected++;
  if (patterns.some((pattern) => pattern.test(source)))
    findings.push({ file, issue: "potential embedded credential" });
}
console.log(
  JSON.stringify(
    {
      status: findings.length ? "FAIL" : "PASS",
      inspected,
      findings,
      scope:
        "Tracked and non-ignored source/text files; known private-key, access-token, JWT and credentialed-database-URL patterns. No credentials are printed. This is a heuristic scan, separate from the built browser-canary check.",
    },
    null,
    2,
  ),
);
if (findings.length) process.exitCode = 1;

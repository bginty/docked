// Read-only repository scan against this task's actual private values; never print them.
import { readFile, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
const connection = JSON.parse(
  await readFile("private-data/hosted-preview/connection.json", "utf8"),
);
if (connection.projectRef !== "bckkllmndoxzpzdqrevb")
  throw new Error("Unexpected preview identity");
const values = [
  connection.secretKey,
  decodeURIComponent(new URL(connection.databaseUrl).password),
];
const keys = JSON.parse(
  await readFile("private-data/hosted-preview-api-keys.json", "utf8"),
);
for (const key of keys)
  if (key.type === "secret" || key.name === "service_role")
    values.push(key.api_key);
const fixture = JSON.parse(
  await readFile("private-data/hosted-preview/acceptance.json", "utf8"),
);
for (const account of Object.values(fixture.accounts))
  values.push(
    account.password,
    account.recoveryPassword,
    account.unsubscribeToken,
  );
const canary = JSON.parse(
  await readFile("private-data/hosted-preview/canary.json", "utf8"),
);
values.push(canary.password);
const needles = [
  ...new Set(
    values
      .filter((value) => typeof value === "string" && value.length >= 20)
      .flatMap((value) => [
        value,
        encodeURIComponent(value),
        Buffer.from(value).toString("base64"),
      ]),
  ),
].map((value) => Buffer.from(value));
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
const findings = [];
let inspected = 0;
for (const file of files) {
  let bytes;
  try {
    bytes = await readFile(file);
  } catch (error) {
    if (error.code === "ENOENT") continue;
    throw error;
  }
  inspected++;
  if (needles.some((value) => bytes.includes(value))) findings.push(file);
}
const report = {
  projectRef: connection.projectRef,
  recordedAt: new Date().toISOString(),
  status: findings.length ? "FAIL" : "PASS",
  files: inspected,
  findings,
};
await writeFile(
  "docs/qa/hosted-preview/repository-secret-audit.json",
  JSON.stringify(report, null, 2) + "\n",
);
console.log(
  `Repository actual-secret scan: ${report.status}; ${inspected} files; ${findings.length} matching files. Secret values omitted.`,
);
if (findings.length) process.exitCode = 1;

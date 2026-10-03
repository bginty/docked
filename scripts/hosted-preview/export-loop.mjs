import { readFile, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";

// Operator-approved capture export only. This never requests mail or creates users.
const project = "bckkllmndoxzpzdqrevb";
if (process.env.DOCKED_HOSTED_ACCEPTANCE !== project)
  throw new Error("Explicit Docked Preview acceptance guard required");
const directory = path.resolve("private-data/hosted-preview");
const fixture = JSON.parse(
  await readFile(path.join(directory, "acceptance.json"), "utf8"),
);
if (
  fixture.projectRef !== project ||
  fixture.mailHook?.verified !== true ||
  fixture.mailHook?.externalDeliveryDisabled !== true
)
  throw new Error("Proven capture-only fixture required");
const emails = Object.values(fixture.accounts).map((a) => a.email);
if (
  emails.length !== 7 ||
  new Set(emails).size !== 7 ||
  emails.some(
    (email) => !/^docked-preview-[a-z0-9-]+@example\.invalid$/.test(email),
  )
)
  throw new Error("Exact reserved test roster required");
const started = Date.now();
let completed = 0;
while (Date.now() - started < 600_000) {
  const code = await new Promise((resolve) => {
    const child = spawn(
      process.execPath,
      [
        "--env-file=.env.local",
        "scripts/hosted-preview-mailbox.mjs",
        ...emails,
      ],
      { stdio: "ignore", windowsHide: true },
    );
    child.once("error", () => resolve(-1));
    child.once("close", resolve);
  });
  if (code !== 0) {
    await writeFile(
      path.join(directory, "export-loop-status.json"),
      JSON.stringify({
        status: "stopped",
        safeCode: "capture-export-guard-or-query-failed",
        completed,
        at: new Date().toISOString(),
      }),
      { mode: 0o600 },
    );
    process.exitCode = 1;
    break;
  }
  completed++;
  await writeFile(
    path.join(directory, "export-loop-status.json"),
    JSON.stringify({
      status: "running",
      completed,
      at: new Date().toISOString(),
    }),
    { mode: 0o600 },
  );
  await new Promise((resolve) => setTimeout(resolve, 2000));
}

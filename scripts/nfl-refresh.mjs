// Manual outbound job only. No scheduler, listener, or shell-expanded credentials.
import { readFileSync, existsSync, mkdirSync } from "node:fs";
import { parseEnv } from "node:util";
import { resolve, dirname } from "node:path";
import { homedir } from "node:os";
import { spawn } from "node:child_process";
const root = resolve(import.meta.dirname, "..");
const file = resolve(root, ".env.nfl-history.local");
const saved = existsSync(file) ? parseEnv(readFileSync(file, "utf8")) : {};
const allowed = [
  "NFL_HISTORY_BATCH_KEY",
  "NFL_PYTHON",
  "NFL_INGESTION_SOURCE",
  "NFL_INGESTION_DATABASE",
];
const config = Object.fromEntries(
  allowed.map((k) => [k, process.env[k] || saved[k] || undefined]),
);
const python =
  config.NFL_PYTHON ??
  resolve(
    homedir(),
    ".cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe",
  );
const source = resolve(
  config.NFL_INGESTION_SOURCE ?? resolve(root, "../docked-nfl-ingestion"),
);
const database = resolve(
  config.NFL_INGESTION_DATABASE ?? resolve(source, "data/nflverse.sqlite"),
);
const problems = [];
if (!existsSync(python))
  problems.push("Set NFL_PYTHON to an installed Python executable.");
if (
  !existsSync(resolve(source, "nflfeed/providers.py")) ||
  !existsSync(database)
)
  problems.push("Existing separate ingestion project/database not found.");
if ((config.NFL_HISTORY_BATCH_KEY ?? "").length < 32)
  problems.push(
    "Private live-history signing key is not configured in .env.nfl-history.local.",
  );
if (problems.length) {
  console.error("NFL refresh not started. " + problems.join(" "));
  process.exit(1);
}
if (process.argv.includes("--check")) {
  console.log(
    "Local configuration present. No refresh or delivery attempted; hosted readiness is not implied.",
  );
  process.exit(0);
}
const output = resolve(
  root,
  "private-data/nfl-history-spool",
  `${Date.now()}.json.gz`,
);
mkdirSync(dirname(output), { recursive: true });
const env = Object.fromEntries(
  Object.entries(process.env).filter(([k]) =>
    /^(PATH|SystemRoot|WINDIR|TEMP|TMP|USERPROFILE)$/i.test(k),
  ),
);
env.NFL_HISTORY_BATCH_KEY = config.NFL_HISTORY_BATCH_KEY;
console.log(
  "Refreshing the separate NFL source, then delivering a signed player-history batch. Automatic scheduling remains off.",
);
const child = spawn(
  python,
  [
    resolve(root, "deployment/nfl-batch/run-job.py"),
    "--source",
    source,
    "--database",
    database,
    "--output",
    output,
    "--refresh",
    "--push",
    "--live-history",
  ],
  { cwd: root, env, stdio: "inherit", windowsHide: true },
);
child.on("error", () => {
  console.error(
    "NFL refresh could not start. No successful delivery is confirmed.",
  );
  process.exitCode = 1;
});
child.on("exit", (code) => {
  if (code !== 0)
    console.error(
      "NFL refresh incomplete. Preserve the private spool and recovery snapshot; do not assume publication succeeded.",
    );
  process.exitCode = code ?? 1;
});

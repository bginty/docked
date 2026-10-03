import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile, copyFile, lstat } from "node:fs/promises";
import path from "node:path";

// No network or cloud mutation. Only reviewed tracked web sources may be exported.
const root = process.cwd();
const git = (...args) => execFileSync("git", args, { encoding: "utf8" }).trim();
const branch = git("branch", "--show-current");
if (branch !== "codex/docked-value-platform")
  throw new Error("Wrong reviewed branch");
const commit = git("rev-parse", "HEAD");
const production = process.argv.includes("--production");
if (process.argv.slice(2).some((argument) => argument !== "--production"))
  throw new Error("Only the explicit --production target is supported");
const target = production ? "production" : "preview";
const targetConfig = JSON.parse(
  await readFile(`config/hosted-${target}.json`, "utf8"),
);
// Match the runtime manifest contract without reading or synthesizing credentials.
const privilegedDatabaseRoles = new Set([
  "postgres",
  "supabase_admin",
  "service_role",
  "authenticator",
  "anon",
  "authenticated",
  "supabase_auth_admin",
  "supabase_storage_admin",
  "supabase_realtime_admin",
  "supabase_replication_admin",
  "dashboard_user",
  "pgbouncer",
]);
if (
  production &&
  (targetConfig.schemaVersion !== 1 ||
    targetConfig.approved !== true ||
    targetConfig.origin !== "https://docked.com.au" ||
    targetConfig.projectName !== "docked-production" ||
    !/^prj_[A-Za-z0-9]+$/.test(targetConfig.vercelProjectId ?? "") ||
    !/^team_[A-Za-z0-9]+$/.test(targetConfig.vercelTeamId ?? "") ||
    targetConfig.vercelProjectId === "prj_C3thcg7PjP1Bnn4kR3rk4oRFegYR" ||
    !/^[a-z]{20}$/.test(targetConfig.supabaseProjectRef ?? "") ||
    targetConfig.supabaseProjectRef === "bckkllmndoxzpzdqrevb" ||
    targetConfig.supabaseProjectRef === "dwdjeecjdkkiidoutnme" ||
    targetConfig.supabaseOrganizationId !== "ernfnkcbalhyqpsrzdwa" ||
    targetConfig.supabaseRegion !== "ap-southeast-2" ||
    typeof targetConfig.databaseRole !== "string" ||
    !/^[a-z][a-z0-9_]{2,62}$/.test(targetConfig.databaseRole) ||
    privilegedDatabaseRoles.has(targetConfig.databaseRole))
)
  throw new Error(
    "Production target identity has not been reviewed and approved",
  );
const roots = ["src/", "public/"];
const explicit = new Set([
  "package.json",
  "package-lock.json",
  "next.config.ts",
  "next-env.d.ts",
  "tsconfig.json",
  "vercel.json",
  ".vercelignore",
  "certs/supabase-prod-ca-2021.crt",
  "scripts/guard-hosted-build.mjs",
  "config/hosted-preview.json",
  "config/hosted-production.json",
]);
const allowed = (file) =>
  explicit.has(file) || roots.some((prefix) => file.startsWith(prefix));
const changed = [
  ...git("diff", "--name-only", "HEAD", "-z").split("\0"),
  ...git("ls-files", "--others", "--exclude-standard", "-z").split("\0"),
].filter(Boolean);
if (changed.some(allowed))
  throw new Error("Commit reviewed web source before preparing deployment");
const files = git("ls-files", "-z")
  .split("\0")
  .filter(Boolean)
  .filter(allowed)
  .sort();
for (const file of explicit)
  if (!files.includes(file))
    throw new Error(`Required tracked file missing: ${file}`);
const parent = path.join(
  root,
  "private-data",
  production ? "production-deploy" : "hosted-deploy",
  commit,
);
const destination = path.join(parent, "source");
await mkdir(destination, { recursive: false }).catch(async (error) => {
  if (error.code !== "ENOENT") throw error;
  await mkdir(parent, { recursive: true });
  await mkdir(destination);
});
const manifest = [];
for (const file of files) {
  const source = path.join(root, file);
  if (!(await lstat(source)).isFile())
    throw new Error(`Non-regular source file rejected: ${file}`);
  const bytes = await readFile(source);
  const target = path.join(destination, file);
  await mkdir(path.dirname(target), { recursive: true });
  await copyFile(source, target);
  manifest.push({
    file,
    bytes: bytes.length,
    sha256: createHash("sha256").update(bytes).digest("hex"),
  });
}
const report = {
  schemaVersion: 1,
  branch,
  commit,
  target,
  projectName: production ? targetConfig.projectName : "docked-preview",
  projectId: production ? targetConfig.vercelProjectId : targetConfig.projectId,
  teamId: production ? targetConfig.vercelTeamId : targetConfig.teamId,
  supabaseProjectRef: targetConfig.supabaseProjectRef,
  sourceDirectory: destination,
  fileCount: manifest.length,
  totalBytes: manifest.reduce((sum, entry) => sum + entry.bytes, 0),
  files: manifest,
};
await writeFile(
  path.join(parent, "source-manifest.json"),
  JSON.stringify(report, null, 2) + "\n",
);
console.log(JSON.stringify({ ...report, files: undefined }, null, 2));

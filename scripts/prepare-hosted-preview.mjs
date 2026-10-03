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
const parent = path.join(root, "private-data", "hosted-deploy", commit);
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
  target: "preview",
  projectName: "docked-preview",
  teamId: "team_tf6xweKKyVCj9bTppUKttJ4l",
  supabaseProjectRef: "bckkllmndoxzpzdqrevb",
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

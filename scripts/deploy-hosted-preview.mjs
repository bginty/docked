import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";

// Vercel CLI omits target for --target preview; a first deployment can then be
// promoted automatically. The REST API's explicit staging target prevents that.
const config = JSON.parse(await readFile("config/hosted-preview.json", "utf8"));
const commit = process.argv[2];
if (
  !/^[a-f0-9]{40}$/.test(commit ?? "") ||
  process.argv[3] !== "--reviewed-export"
)
  throw new Error(
    "Exact reviewed source commit and export acknowledgement required",
  );
const directory = path.join("private-data", "hosted-deploy", commit);
const manifest = JSON.parse(
  await readFile(path.join(directory, "source-manifest.json"), "utf8"),
);
const dry = JSON.parse(
  await readFile(path.join(directory, "deploy-dry-run.json"), "utf8"),
);
const audit = JSON.parse(
  await readFile(
    "docs/qa/android-https-preview/deployment-source-audit.json",
    "utf8",
  ),
);
if (
  config.projectId !== "prj_C3thcg7PjP1Bnn4kR3rk4oRFegYR" ||
  config.teamId !== "team_tf6xweKKyVCj9bTppUKttJ4l" ||
  config.target !== "preview" ||
  manifest.commit !== commit ||
  manifest.target !== "preview" ||
  manifest.teamId !== config.teamId ||
  manifest.projectName !== config.projectName ||
  audit.status !== "PASS" ||
  audit.filesScanned !== manifest.fileCount ||
  dry.fileCount !== manifest.fileCount
)
  throw new Error("Reviewed preview inputs do not match");
const files = [];
for (const file of manifest.files) {
  if (path.isAbsolute(file.file) || file.file.includes(".."))
    throw new Error("Source path denied");
  const bytes = await readFile(path.join(directory, "source", file.file));
  const input = dry.files.find((entry) => entry.path === file.file);
  if (
    !input ||
    bytes.length !== file.bytes ||
    input.size !== file.bytes ||
    createHash("sha256").update(bytes).digest("hex") !== file.sha256 ||
    createHash("sha1").update(bytes).digest("hex") !== input.sha
  )
    throw new Error("Export/dry-run content changed after review");
  files.push({ file: file.file, sha: input.sha, size: input.size });
}
const auth = JSON.parse(
  await readFile("private-data/vercel-cli/auth.json", "utf8"),
);
async function api(route, method = "GET", body = undefined) {
  const response = await fetch(
    `https://api.vercel.com${route}?teamId=${config.teamId}`,
    {
      method,
      redirect: "error",
      signal: AbortSignal.timeout(60000),
      headers: {
        Authorization: `Bearer ${auth.token}`,
        "Content-Type": "application/json",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    },
  );
  if (!response.ok)
    throw new Error(`Explicit preview operation failed (${response.status})`);
  return response.json();
}
const project = await api(`/v9/projects/${config.projectId}`);
if (
  project.id !== config.projectId ||
  project.accountId !== config.teamId ||
  project.name !== config.projectName
)
  throw new Error("Live preview identity mismatch");
const deployment = await api("/v13/deployments", "POST", {
  name: config.projectName,
  project: config.projectId,
  target: "staging",
  files,
  projectSettings: {
    framework: "nextjs",
    buildCommand: "node scripts/guard-hosted-build.mjs && npm run build",
    installCommand: "npm ci",
    nodeVersion: "22.x",
  },
  regions: ["syd1"],
  meta: {
    dockedSourceCommit: commit,
    githubCommitSha: commit,
    githubCommitRef: "codex/docked-value-platform",
  },
  gitMetadata: {
    remoteUrl: "https://github.com/bginty/docked.git",
    commitRef: "codex/docked-value-platform",
    commitSha: commit,
    dirty: false,
  },
});
await writeFile(
  path.join(directory, "staging-deployment.json"),
  JSON.stringify(deployment, null, 2),
);
if (deployment.target === "production") {
  await api(`/v12/deployments/${deployment.id}/cancel`, "PATCH");
  throw new Error(
    "Cancelled platform auto-production override immediately; preview build guard also prevents compilation",
  );
}
if (![null, "staging"].includes(deployment.target))
  throw new Error(
    "Platform returned an unexpected target; do not use deployment",
  );
console.log(
  JSON.stringify({
    id: deployment.id,
    url: deployment.url,
    target: deployment.target,
    readyState: deployment.readyState,
    projectId: config.projectId,
    sourceCommit: commit,
  }),
);

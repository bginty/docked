// Deploy reviewed web-only exports to the existing isolated Preview project.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import path from "node:path";
const project = "prj_C3thcg7PjP1Bnn4kR3rk4oRFegYR",
  team = "team_tf6xweKKyVCj9bTppUKttJ4l";
const branch = "pivot/fantasy-cards-preview-v1";
const origin = "https://docked-preview-s24-briant-ginty.vercel.app";
const root = process.cwd();
async function main() {
  const mode = process.argv[2];
  if (!["deploy", "alias"].includes(mode)) throw Error("MODE_DENIED");
  const git = (...args) =>
    execFileSync("git", args, { encoding: "utf8", windowsHide: true }).trim();
  if (git("branch", "--show-current") !== branch) throw Error("BRANCH_DENIED");
  const sha = git("rev-parse", "HEAD");
  const { token } = JSON.parse(
    await readFile("private-data/vercel-cli/auth.json", "utf8"),
  );
  const api = async (p, options = {}) => {
    const r = await fetch(
      `https://api.vercel.com${p}${p.includes("?") ? "&" : "?"}teamId=${team}`,
      {
        ...options,
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        redirect: "error",
        signal: AbortSignal.timeout(30000),
      },
    );
    if (!r.ok) throw Error(`VERCEL_HTTP_${r.status}`);
    return r.json();
  };
  const p = await api(`/v9/projects/${project}`);
  if (p.id !== project || p.name !== "docked-preview" || p.accountId !== team)
    throw Error("PROJECT_DENIED");
  await mkdir("private-data/fantasy", { recursive: true });
  if (mode === "deploy") {
    const source = path.join(
      root,
      "private-data",
      "hosted-deploy",
      sha,
      "source",
    );
    const manifest = JSON.parse(
      await readFile(path.join(source, "../source-manifest.json"), "utf8"),
    );
    if (
      manifest.commit !== sha ||
      manifest.projectId !== project ||
      manifest.target !== "preview" ||
      manifest.branch !== branch
    )
      throw Error("EXPORT_DENIED");
    const cli = path.join(
      process.env.LOCALAPPDATA,
      "npm-cache/_npx/67eb4586ca667318/node_modules/vercel/dist/index.js",
    );
    const args = [
      cli,
      "deploy",
      source,
      "--project",
      project,
      "--target",
      "preview",
      "--yes",
      "--no-wait",
      "--scope",
      team,
      "--global-config",
      path.join(root, "private-data/vercel-cli"),
      "--env",
      "FANTASY_CARDS_PREVIEW=true",
      "--build-env",
      "FANTASY_CARDS_PREVIEW=true",
      "--env",
      `DOCKED_CODE_COMMIT=${sha}`,
      "--build-env",
      `DOCKED_CODE_COMMIT=${sha}`,
      "--meta",
      `githubCommitSha=${sha}`,
      "--meta",
      `githubCommitRef=${branch}`,
    ];
    const log = execFileSync(process.execPath, args, {
      encoding: "utf8",
      windowsHide: true,
      timeout: 180000,
      stdio: ["ignore", "pipe", "pipe"],
    });
    await writeFile("private-data/fantasy/deploy.log", log, { mode: 0o600 });
    console.log("Isolated Preview deployment submitted; source " + sha);
    return;
  }
  const list = await api(`/v6/deployments?projectId=${project}&limit=10`);
  const selected = list.deployments.find(
    (d) =>
      d.meta?.githubCommitSha === sha &&
      d.meta?.githubCommitRef === branch &&
      d.target !== "production",
  );
  if (!selected) throw Error("DEPLOYMENT_NOT_FOUND");
  const d = await api(`/v13/deployments/${selected.uid}`);
  if (
    d.projectId !== project ||
    d.target === "production" ||
    d.readyState !== "READY"
  ) {
    console.log(JSON.stringify({ deploymentId: d.id, state: d.readyState }));
    return;
  }
  const url = `https://${d.url}`;
  const response = await fetch(url + "/api/status", {
    redirect: "error",
    signal: AbortSignal.timeout(30000),
  });
  const health = await response.json();
  if (
    response.status !== 200 ||
    health.publication !== false ||
    health.strategy !== false
  )
    throw Error("HEALTH_DENIED");
  const home = await fetch(url, { redirect: "error" });
  if (!home.ok || !(await home.text()).includes("COLLECT. BUILD. COMPETE."))
    throw Error("FANTASY_HOME_DENIED");
  const changed = await api(`/v2/deployments/${d.id}/aliases`, {
    method: "POST",
    body: JSON.stringify({ alias: new URL(origin).hostname }),
  });
  const alias = await api(`/v4/aliases/${new URL(origin).hostname}`);
  if ((alias.deployment?.id ?? alias.deploymentId) !== d.id)
    throw Error("ALIAS_VERIFY_FAILED");
  const receipt = {
    recordedAt: new Date().toISOString(),
    projectId: project,
    teamId: team,
    deploymentId: d.id,
    sourceCommit: sha,
    origin,
    url,
    target: "preview",
    health,
    previousDeploymentId: changed.oldDeploymentId ?? null,
    productionChanged: false,
    dnsChanged: false,
  };
  await writeFile(
    "docs/qa/fantasy/deployment.json",
    JSON.stringify(receipt, null, 2),
  );
  const android = JSON.parse(
    await readFile("config/android-preview.json", "utf8"),
  );
  android.deploymentId = d.id;
  android.verifiedAt = receipt.recordedAt;
  await writeFile(
    "config/android-preview.json",
    JSON.stringify(android, null, 2) + "\n",
  );
  console.log(JSON.stringify(receipt));
}
main().catch(async (e) => {
  await mkdir("private-data/fantasy", { recursive: true });
  await writeFile(
    "private-data/fantasy/deploy-error.txt",
    String(e?.stack ?? e),
    { mode: 0o600 },
  );
  console.error("Preview deployment failed; private diagnostic retained.");
  process.exitCode = 1;
});

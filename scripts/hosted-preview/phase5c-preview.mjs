// Exact existing Preview alias only. No production promotion, environment or DNS operation.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { execFileSync } from "node:child_process";
const project = "prj_C3thcg7PjP1Bnn4kR3rk4oRFegYR";
const team = "team_tf6xweKKyVCj9bTppUKttJ4l";
const origin = "https://docked-preview-s24-briant-ginty.vercel.app";
try {
  const mode = process.argv[2];
  if (!["deployments", "preview-alias"].includes(mode))
    throw Error("MODE_DENIED");
  const { token } = JSON.parse(
    await readFile("private-data/vercel-cli/auth.json", "utf8"),
  );
  const api = async (path, options = {}) => {
    const r = await fetch(
      `https://api.vercel.com${path}${path.includes("?") ? "&" : "?"}teamId=${team}`,
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
  const sha = execFileSync("git", ["rev-parse", "HEAD"], {
    encoding: "utf8",
    windowsHide: true,
  }).trim();
  const branch = execFileSync("git", ["branch", "--show-current"], {
    encoding: "utf8",
    windowsHide: true,
  }).trim();
  if (branch !== "codex/docked-value-platform") throw Error("BRANCH_DENIED");
  if (mode === "deployments") {
    const ds = await api(`/v6/deployments?projectId=${project}&limit=12`);
    console.log(
      JSON.stringify(
        ds.deployments.map((d) => ({
          id: d.uid,
          url: d.url,
          state: d.readyState ?? d.state,
          sha: d.meta?.githubCommitSha,
          branch: d.meta?.githubCommitRef,
          target: d.target,
          head: d.meta?.githubCommitSha === sha,
        })),
      ),
    );
  } else {
    const deploymentId = process.argv[3];
    if (!/^dpl_[a-zA-Z0-9]+$/.test(deploymentId ?? ""))
      throw Error("DEPLOYMENT_DENIED");
    const d = await api(`/v13/deployments/${deploymentId}`);
    if (
      d.projectId !== project ||
      d.readyState !== "READY" ||
      d.target === "production" ||
      d.meta?.githubCommitSha !== sha ||
      d.meta?.githubCommitRef !== branch
    )
      throw Error("SOURCE_DENIED");
    const url = `https://${d.url}`;
    if (
      !/^https:\/\/docked-preview-[a-z0-9-]+-briant-s-projects\.vercel\.app$/.test(
        url,
      )
    )
      throw Error("HOST_DENIED");
    const response = await fetch(`${url}/api/status`, {
      redirect: "error",
      signal: AbortSignal.timeout(20000),
    });
    const health = await response.json();
    if (
      response.status !== 200 ||
      health.publication !== false ||
      health.strategy !== false
    )
      throw Error("HEALTH_DENIED");
    const result = await api(`/v2/deployments/${deploymentId}/aliases`, {
      method: "POST",
      body: JSON.stringify({ alias: new URL(origin).hostname }),
    });
    const alias = await api(`/v4/aliases/${new URL(origin).hostname}`);
    if ((alias.deployment?.id ?? alias.deploymentId) !== deploymentId)
      throw Error("ALIAS_VERIFY_FAILED");
    await mkdir("docs/qa/phase5c/operator", { recursive: true });
    const receipt = {
      recordedAt: new Date().toISOString(),
      projectId: project,
      teamId: team,
      deploymentId,
      sourceCommit: sha,
      origin,
      url,
      target: "preview",
      health,
      previousDeploymentId: result.oldDeploymentId ?? null,
      productionChanged: false,
      dnsChanged: false,
    };
    await writeFile(
      "docs/qa/phase5c/operator/deployment.json",
      JSON.stringify(receipt, null, 2) + "\n",
      { flag: "wx" },
    );
    console.log(JSON.stringify(receipt));
  }
} catch (error) {
  console.error(
    error instanceof Error && /^[A-Z_0-9]+$/.test(error.message)
      ? error.message
      : "PREVIEW_ACTION_FAILED",
  );
  process.exitCode = 1;
}

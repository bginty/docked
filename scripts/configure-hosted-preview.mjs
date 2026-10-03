import { readFile, writeFile } from "node:fs/promises";

// Uses the operator's explicitly authorised official CLI session. Never logs tokens,
// environment values or API response bodies. No production or unrelated target.
const config = JSON.parse(await readFile("config/hosted-preview.json", "utf8"));
if (
  config.projectId !== "prj_C3thcg7PjP1Bnn4kR3rk4oRFegYR" ||
  config.teamId !== "team_tf6xweKKyVCj9bTppUKttJ4l" ||
  config.projectName !== "docked-preview" ||
  config.target !== "preview"
)
  throw new Error("Preview target denied");
const auth = JSON.parse(
  await readFile("private-data/vercel-cli/auth.json", "utf8"),
);
if (!auth.token) throw new Error("Authorised Vercel CLI session unavailable");
async function api(route, method = "GET", body = undefined) {
  const response = await fetch(
    `https://api.vercel.com${route}${route.includes("?") ? "&" : "?"}teamId=${config.teamId}`,
    {
      method,
      redirect: "error",
      signal: AbortSignal.timeout(30000),
      headers: {
        Authorization: `Bearer ${auth.token}`,
        "Content-Type": "application/json",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    },
  );
  if (!response.ok)
    throw new Error(`Vercel preview operation failed (${response.status})`);
  return response.json();
}
const project = await api(`/v9/projects/${config.projectId}`);
if (
  project.id !== config.projectId ||
  project.name !== config.projectName ||
  project.accountId !== config.teamId
)
  throw new Error("Live project identity mismatch");
const mode = process.argv[2];
if (mode === "--configure-env") {
  const vars = JSON.parse(
    await readFile(
      "private-data/hosted-deploy/environment-payload.json",
      "utf8",
    ),
  );
  if (
    !Array.isArray(vars) ||
    vars.some(
      (entry) => entry.target?.length !== 1 || entry.target[0] !== "preview",
    )
  )
    throw new Error("Only preview-scoped environment variables allowed");
  const result = await api(
    `/v10/projects/${config.projectId}/env?upsert=true`,
    "POST",
    vars,
  );
  if (result.failed?.length)
    throw new Error(
      `Environment operation returned ${result.failed.length} failures`,
    );
  const stored = await api(`/v9/projects/${config.projectId}/env`);
  const entries = stored.envs ?? [];
  for (const expected of vars) {
    const match = entries.find(
      (entry) =>
        entry.key === expected.key &&
        entry.target?.length === 1 &&
        entry.target[0] === "preview",
    );
    if (!match || match.type !== expected.type)
      throw new Error("Stored environment metadata did not match");
  }
  const report = {
    projectId: config.projectId,
    target: "preview",
    count: vars.length,
    keys: vars.map(({ key, type }) => ({ key, type })),
    productionVariables: entries.filter((entry) =>
      entry.target?.includes("production"),
    ).length,
  };
  await writeFile(
    "private-data/hosted-deploy/environment-audit.json",
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report));
} else if (mode === "--remove-unexpected-first-deployment") {
  const id = process.argv[3];
  if (
    ![
      "dpl_67an1iQjWgqzS6wb7mvnNbhR2nWK",
      "dpl_7Ca6F1Mt8PcZpui4jTtXCB852ZW4",
    ].includes(id)
  )
    throw new Error(
      "Only the two accidental isolated bootstrap deployments may be removed",
    );
  const deployment = await api(`/v13/deployments/${id}`);
  if (
    deployment.projectId !== config.projectId ||
    deployment.name !== config.projectName ||
    deployment.target !== "production"
  )
    throw new Error("Unexpected deployment cleanup target denied");
  await api(`/v13/deployments/${id}`, "DELETE");
  console.log(
    "Removed only the new isolated project's mistakenly classified first deployment; existing production was not touched.",
  );
} else if (["--inspect-deployment", "--assign-android-alias"].includes(mode)) {
  const id = process.argv[3];
  if (!/^dpl_[A-Za-z0-9]+$/.test(id ?? ""))
    throw new Error("Deployment id required");
  const deployed = await api(`/v13/deployments/${id}`);
  if (
    deployed.projectId !== config.projectId ||
    deployed.name !== config.projectName
  )
    throw new Error("Deployment belongs to another project");
  const summary = {
    id,
    projectId: deployed.projectId,
    target: deployed.target,
    readyState: deployed.readyState,
    url: deployed.url,
    aliases: deployed.alias,
    sourceCommit: deployed.meta?.dockedSourceCommit,
  };
  if (mode === "--assign-android-alias") {
    if (deployed.target !== null || deployed.readyState !== "READY")
      throw new Error(
        "Only ready Preview deployments may receive the Android alias",
      );
    const host = new URL(config.origin).hostname;
    if (host !== "docked-preview-s24-briant-ginty.vercel.app")
      throw new Error("Preview hostname denied");
    const existing = await fetch(
      `https://api.vercel.com/v4/aliases/${host}?teamId=${config.teamId}`,
      {
        redirect: "error",
        headers: { Authorization: `Bearer ${auth.token}` },
        signal: AbortSignal.timeout(30000),
      },
    );
    if (existing.ok) {
      const alias = await existing.json();
      if (alias.projectId !== config.projectId)
        throw new Error("Alias is already owned by a different project");
    } else if (existing.status !== 404)
      throw new Error("Alias ownership could not be verified");
    await api(`/v2/deployments/${id}/aliases`, "POST", { alias: host });
    await writeFile(
      "private-data/hosted-deploy/active-deployment.json",
      JSON.stringify({ ...summary, origin: config.origin }, null, 2),
    );
  }
  console.log(JSON.stringify(summary));
} else if (mode === "--audit") {
  const active = JSON.parse(
    await readFile("private-data/hosted-deploy/active-deployment.json", "utf8"),
  );
  const deployed = await api(`/v13/deployments/${active.id}`);
  const inventory = await api(
    `/v6/deployments?projectId=${config.projectId}&limit=100`,
  );
  const environment = await api(`/v9/projects/${config.projectId}/env`);
  const alias = await api(`/v4/aliases/${new URL(config.origin).hostname}`);
  if (
    deployed.projectId !== config.projectId ||
    deployed.target !== null ||
    deployed.readyState !== "READY" ||
    alias.projectId !== config.projectId ||
    alias.deploymentId !== active.id
  )
    throw new Error("Ready preview deployment/alias identity mismatch");
  const productionDeployments = inventory.deployments.filter(
    (entry) => entry.target === "production",
  );
  const productionVariables = (environment.envs ?? []).filter((entry) =>
    entry.target?.includes("production"),
  );
  if (productionDeployments.length || productionVariables.length)
    throw new Error(
      "Unexpected production configuration exists on isolated preview project",
    );
  const statusResponse = await fetch(`${config.origin}/api/status`, {
    redirect: "error",
    signal: AbortSignal.timeout(30000),
  });
  const status = await statusResponse.json();
  const homeResponse = await fetch(`${config.origin}/home`, {
    redirect: "error",
    signal: AbortSignal.timeout(30000),
  });
  const home = await homeResponse.text();
  if (
    !statusResponse.ok ||
    status.database !== true ||
    status.feed !== false ||
    status.strategy !== false ||
    status.publication !== false ||
    status.oddsProviderStatus !== "NOT_CONFIGURED" ||
    status.resultsProviderStatus !== "NOT_CONFIGURED" ||
    !homeResponse.ok ||
    !home.includes("Sport. Perspective. Evidence.") ||
    home.includes("Connect the reviewed preview")
  )
    throw new Error("Public preview health/content check failed");
  const report = {
    checkedAt: new Date().toISOString(),
    projectId: config.projectId,
    projectName: config.projectName,
    teamId: config.teamId,
    origin: config.origin,
    deploymentId: active.id,
    target: "preview",
    readyState: deployed.readyState,
    sourceCommit: deployed.meta?.dockedSourceCommit,
    supabaseProjectRef: config.supabaseProjectRef,
    productionDeployments: productionDeployments.length,
    productionEnvironmentVariables: productionVariables.length,
    previewEnvironmentVariables: (environment.envs ?? []).filter(
      (entry) => entry.target?.length === 1 && entry.target[0] === "preview",
    ).length,
    activeDeployments: inventory.deployments.map(({ uid, target, state }) => ({
      id: uid,
      target,
      state,
    })),
    publicHttpsHealth: status,
    actualHomeRendered: true,
    foundationInstructionsPresent: false,
    existingProductionTouched: false,
    productionDnsChanged: false,
    bootstrapIncident:
      "Two initial deployments were automatically classified production by Vercel in this new isolated project despite explicit preview/staging requests. Both were removed. No production-scoped credentials were configured. A build guard now refuses non-preview compilation.",
    removedBootstrapDeployments: [
      "dpl_67an1iQjWgqzS6wb7mvnNbhR2nWK",
      "dpl_7Ca6F1Mt8PcZpui4jTtXCB852ZW4",
    ],
  };
  await writeFile(
    "docs/qa/android-https-preview/hosting-audit.json",
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(JSON.stringify(report));
} else if (mode === "--inspect") {
  console.log(
    JSON.stringify({
      id: project.id,
      name: project.name,
      accountId: project.accountId,
      nodeVersion: project.nodeVersion,
      ssoProtection: project.ssoProtection,
      targets: Object.keys(project.targets ?? {}),
    }),
  );
} else throw new Error("Use --configure-env or --inspect");

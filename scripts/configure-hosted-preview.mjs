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

/** Deploy only the existing free, SSO-protected Preview. Never promotes Production. */
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { execFileSync, spawn } from "node:child_process";
import { assertIsolatedPublicPreview } from "../src/core/isolated-public-preview.mjs";
const main = "C:/Users/61412/Documents/ChatGPT/Docked.com.au",
  dir = "private-data/restored-public-preview";
const project = "prj_C3thcg7PjP1Bnn4kR3rk4oRFegYR",
  team = "team_tf6xweKKyVCj9bTppUKttJ4l";
const cli =
  "C:/Users/61412/AppData/Local/npm-cache/_npx/67eb4586ca667318/node_modules/vercel/dist/index.js";
const auth = JSON.parse(
  await fs.readFile(main + "/private-data/vercel-cli/auth.json", "utf8"),
);
const api = async (p) => {
  const r = await fetch(
    `https://api.vercel.com${p}${p.includes("?") ? "&" : "?"}teamId=${team}`,
    { headers: { Authorization: `Bearer ${auth.token}` }, redirect: "error" },
  );
  assert(r.ok, `Vercel API ${r.status}`);
  return r.json();
};
const p = await api(`/v9/projects/${project}`);
assert.equal(p.id, project);
assert.equal(p.ssoProtection?.deploymentType, "all");
const mode = process.argv[2];
assert(["deploy", "status", "alias", "oidc"].includes(mode));
const source = path.resolve(dir, "source");
async function run(args, env = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [
        cli,
        ...args,
        "--global-config",
        main + "/private-data/vercel-cli",
        "--scope",
        team,
      ],
      { env: { ...process.env, ...env }, windowsHide: true },
    );
    let log = "";
    child.stdout.on("data", (v) => (log += v));
    child.stderr.on("data", (v) => (log += v));
    child.on("error", reject);
    child.on("exit", async (code) => {
      await fs.writeFile(`${dir}/${mode}.private.log`, log, { mode: 0o600 });
      if (code)
        reject(Error(`Vercel ${mode} failed (${code}); inspect private log`));
      else resolve(log);
    });
  });
}
if (mode === "deploy") {
  const fixture = JSON.parse(
    await fs.readFile(`${dir}/fixture.private.json`, "utf8"),
  );
  const git = (...a) =>
    execFileSync("git", a, { encoding: "utf8", windowsHide: true }).trim();
  const sha = git("rev-parse", "HEAD");
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
  ]);
  const allowed = (f) =>
    ["src/", "public/", "config/"].some((x) => f.startsWith(x)) ||
    explicit.has(f);
  assert(
    !git("diff", "--name-only", "HEAD").split("\n").some(allowed),
    "Commit source before hosted release",
  );
  const files = git("ls-files", "-z")
    .split("\0")
    .filter(Boolean)
    .filter(allowed);
  await fs.mkdir(source, { recursive: true });
  const archive = path.resolve(dir, "source.tar");
  execFileSync(
    "git",
    ["archive", "--format=tar", "--output=" + archive, sha, ...files],
    { windowsHide: true },
  );
  execFileSync("tar", ["-xf", archive, "-C", source], { windowsHide: true });
  await fs.mkdir(path.join(source, ".vercel"), { recursive: true });
  await fs.writeFile(
    path.join(source, ".vercel/project.json"),
    JSON.stringify({ orgId: team, projectId: project, projectName: p.name }),
  );
  // Blank inherited app configuration before supplying an explicit safe runtime.
  const inherited = await api(`/v9/projects/${project}/env`);
  const env = Object.fromEntries(
    inherited.envs
      .filter((v) =>
        /^(DOCKED_|NEXT_PUBLIC_|SUPABASE_|DATABASE_|SMTP_|GRAPH_|MICROSOFT_|NFL_|BETA_|FANTASY_|PROVIDER_|CRON_|REGISTRATION_|PRIZES_|COMPETITIONS_|PAID_|SENDING_|PRO_)/.test(
          v.key,
        ),
      )
      .map((v) => [v.key, ""]),
  );
  for (const flag of [
    "DOCKED_BETA_STAGING",
    "DOCKED_PRIVATE_PREVIEW",
    "DOCKED_HOSTED_PRODUCTION",
    "DOCKED_HOSTED_REVIEW",
    "DOCKED_HOSTED_PREVIEW",
    "DOCKED_FRIENDS_BETA",
    "DOCKED_COMMERCIAL_CHECKOUT",
    "DOCKED_RETENTION_SERVICE",
    "DOCKED_RETENTION_APPLY",
    "PRIZES_ENABLED",
    "COMPETITIONS_ENABLED",
    "PAID_PLANS_ENABLED",
    "SENDING_ENABLED",
    "PRO_ENTITLEMENTS_ENABLED",
    "DOCKED_OWNER_GAMEPLAY",
    "DOCKED_MEMBER_GOOGLE_TEST",
    "DOCKED_SPORTS_TEST_COMMERCE",
    "DOCKED_GOOGLE_RECONCILIATION_ENABLED",
    "DOCKED_NBA_PRIVATE_BETA",
    "DOCKED_SPORTS_PRIVATE_BETA",
    "DOCKED_MULTI_SPORT_SANDBOX",
    "DOCKED_WEEKLY_CORE_ENABLED",
  ])
    env[flag] = "false";
  Object.assign(env, {
    APP_ENV: "preview",
    SUPABASE_ENV: "preview",
    DOCKED_ISOLATED_PUBLIC: "true",
    DOCKED_PUBLIC_CUSTOMERS: "true",
    REGISTRATION_ENABLED: "true",
    SITE_URL: fixture.origin,
    NEXT_PUBLIC_SUPABASE_URL: `https://${fixture.projectRef}.supabase.co`,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: fixture.publishableKey,
    DATABASE_URL: fixture.runtime,
    DATABASE_RUNTIME: "serverless",
    DOCKED_COMMERCIAL_DATABASE_URL: fixture.commerce,
    DOCKED_COMMERCIAL_SERVICE: "true",
    DOCKED_COMMERCIAL_SURFACES: "true",
    DOCKED_COMMERCIAL_REFERENCE_KEY: fixture.referenceKey,
    DOCKED_COMMERCIAL_ACCOUNT_BINDING_SECRET: fixture.accountBinding,
    VERCEL_GIT_COMMIT_SHA: sha,
    VERCEL_GIT_COMMIT_REF: "codex/member-platform-updates",
    VERCEL_PROJECT_ID: project,
    VERCEL_ORG_ID: team,
  });
  assert(
    assertIsolatedPublicPreview({
      ...env,
      VERCEL: "1",
      VERCEL_ENV: "preview",
      VERCEL_TARGET_ENV: "preview",
      VERCEL_URL: "docked-preview-acceptance.vercel.app",
    }),
  );
  const args = [
    "deploy",
    "--cwd",
    source,
    "--yes",
    "--no-wait",
    "--meta",
    `githubCommitSha=${sha}`,
  ];
  for (const key of Object.keys(env))
    args.push("--env", key, "--build-env", key);
  const log = await run(args, env);
  const urls = [
    ...log.matchAll(/https:\/\/docked-preview-[a-z0-9-]+\.vercel\.app/g),
  ].map((v) => v[0]);
  assert(urls.length);
  const receipt = {
    url: urls.at(-1),
    commit: sha,
    project,
    submittedAt: new Date().toISOString(),
    productionChanged: false,
  };
  await fs.writeFile(
    `${dir}/deployment.json`,
    JSON.stringify(receipt, null, 2),
  );
  console.log(JSON.stringify(receipt));
} else {
  const r = JSON.parse(await fs.readFile(`${dir}/deployment.json`, "utf8"));
  const d = await api(`/v13/deployments/${new URL(r.url).hostname}`);
  assert.equal(d.projectId, project);
  assert.notEqual(d.target, "production");
  if (mode === "alias") {
    assert.equal(d.readyState, "READY");
    await run([
      "alias",
      "set",
      r.url,
      "docked-preview-s24-briant-ginty.vercel.app",
      "--cwd",
      source,
    ]);
    console.log(
      "Existing protected Preview alias updated; Production unchanged.",
    );
  } else if (mode === "oidc") {
    await run([
      "env",
      "pull",
      path.resolve(dir, "oidc.private.env"),
      "--yes",
      "--environment",
      "development",
      "--cwd",
      source,
    ]);
    console.log(
      "Short-lived same-project Preview testing credential refreshed privately.",
    );
  } else
    console.log(
      JSON.stringify({
        url: r.url,
        commit: r.commit,
        state: d.readyState,
        id: d.id,
        error: d.errorMessage,
        target: d.target,
        productionChanged: false,
      }),
    );
}

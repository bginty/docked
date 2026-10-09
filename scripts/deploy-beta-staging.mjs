// One-off protected Preview deployment, never project/domain/production updates.
// Secrets are read privately and passed to the existing CLI, never printed.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { execFileSync, spawnSync } from "node:child_process";
import { resolve, dirname, join } from "node:path";
import assert from "node:assert/strict";
import { assertHostedBeta } from "../src/core/hosted-beta.mjs";
const mode = process.argv[2];
const ownerAuth = process.argv[3] === "--owner-auth";
assert.ok(process.argv.length <= 4 && (!process.argv[3] || ownerAuth));
assert.ok(["--prepare", "--deploy", "--status"].includes(mode));
const project = "prj_l0rpVDPRuIRp9UcBUkudeyUK5yST",
  team = "team_tf6xweKKyVCj9bTppUKttJ4l",
  branch = "codex/vercel-beta-review";
const git = (...args) =>
  execFileSync("git", args, {
    encoding: "utf8",
    windowsHide: true,
    maxBuffer: 20 * 1024 * 1024,
  }).trim();
const sha = git("rev-parse", "HEAD");
assert.match(sha, /^[a-f0-9]{40}$/);
assert.equal(
  git("rev-parse", "origin/" + branch),
  sha,
  "Push exact reviewed commit first",
);
assert.ok(git("remote", "get-url", "origin").includes("bginty/docked"));
const auth = JSON.parse(
  readFileSync("private-data/vercel-cli/auth.json", "utf8"),
);
async function api(path, options = {}) {
  const r = await fetch(
    "https://api.vercel.com" +
      path +
      (path.includes("?") ? "&" : "?") +
      "teamId=" +
      team,
    {
      ...options,
      headers: {
        Authorization: "Bearer " + auth.token,
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(30000),
      redirect: "error",
    },
  );
  if (!r.ok) throw Error("VERCEL_HTTP_" + r.status);
  return r.json();
}
const p = await api("/v9/projects/" + project);
assert.equal(p.id, project);
assert.equal(p.accountId, team);
assert.equal(p.link.productionBranch, "main");
assert.equal(p.link.org, "bginty");
assert.equal(p.link.repo, "docked");
assert.equal(p.ssoProtection.deploymentType, "all_except_custom_domains");
const domains = await api("/v9/projects/" + project + "/domains");
assert.equal(
  domains.domains.filter((d) => !d.name.endsWith(".vercel.app")).length,
  0,
);
const output = "docs/qa/beta-isolation";
mkdirSync(output, { recursive: true });
if (mode === "--status") {
  const record = JSON.parse(
    readFileSync(output + "/deployment-submitted.json", "utf8"),
  );
  const d = await api("/v13/deployments/" + record.id);
  if (d.target === "production") {
    await api("/v12/deployments/" + d.id + "/cancel", { method: "PATCH" });
    throw Error("Unexpected production target cancelled");
  }
  assert.equal(d.projectId ?? d.project?.id, project);
  assert.equal(d.target, null);
  assert.equal(d.meta.githubCommitSha, record.commit);
  assert.equal(d.meta.githubCommitRef, branch);
  const report = {
    id: d.id,
    url: "https://" + d.url,
    state: d.readyState,
    rawTarget: d.target,
    effectiveTarget: "preview",
    commit: record.commit,
    project,
    team,
    branch,
    customDomains: [],
    aliases: d.alias ?? [],
    checkedAt: new Date().toISOString(),
  };
  writeFileSync(
    output + "/deployment-status.json",
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(JSON.stringify(report));
} else {
  const c = JSON.parse(
    readFileSync(
      "private-data/production/beta-runtime-connection.json",
      "utf8",
    ),
  );
  assert.equal(c.projectRef, "pojoymtniryarxxunyvz");
  assert.equal(c.databaseRole, "docked_beta_app");
  const env = {
    // Keep the protected application's CSP intact; the optional toolbar is not part of Docked.
    VERCEL_PREVIEW_FEEDBACK_ENABLED: "0",
    DOCKED_BETA_STAGING: "true",
    VERCEL_ORG_ID: team,
    VERCEL_PROJECT_ID: project,
    VERCEL_GIT_COMMIT_REF: branch,
    VERCEL_GIT_COMMIT_SHA: sha,
    APP_ENV: "production",
    SUPABASE_ENV: "production",
    DOCKED_RELEASE_CHANNEL: "beta",
    DATABASE_URL: c.databaseUrl,
    DATABASE_CONNECTION_MODE: "session",
    DATABASE_RUNTIME: "serverless",
    NEXT_PUBLIC_SUPABASE_URL: c.supabaseUrl,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: c.publishableKey,
    DOCKED_HOSTED_REVIEW: "false",
    DOCKED_HOSTED_PREVIEW: "false",
    DOCKED_HOSTED_PRODUCTION: "false",
  };
  for (const flag of [
    "BETA_ACCESS_ENABLED",
    "BETA_TESTERS_ENABLED",
    "REGISTRATION_ENABLED",
    "AUTH_EMAIL_ENABLED",
    "DOCKED_AUTH_INVITES_READY",
    "FANTASY_FREE_PLAY_PRODUCTION",
    "FANTASY_CARDS_PREVIEW",
    "LEGAL_ENTITY_VERIFIED",
    "DEMO_MODE",
    "ODDS_POLLING_ENABLED",
    "MARKET_DATA_POLLING_ENABLED",
    "EDGE_SCANNER_ENABLED",
    "PUBLICATION_ENABLED",
    "FORWARD_PAPER_ENABLED",
    "AUTO_PUBLISH_DOCKED_EDGES",
    "SENDING_ENABLED",
    "ADS_ENABLED",
    "AFFILIATES_ENABLED",
    "PAID_PLANS_ENABLED",
    "PRO_ENTITLEMENTS_ENABLED",
    "COMPETITIONS_ENABLED",
    "PRIZES_ENABLED",
    "DEALS_ENABLED",
  ])
    env[flag] = "false";
  if (ownerAuth) {
    const approval = JSON.parse(
      readFileSync("config/hosted-beta.json", "utf8"),
    );
    assert.equal(approval.ownerAcceptanceApproved, true);
    assert.equal(
      approval.policyApproval.scope.ownerOnlyAcceptanceAuthorized,
      true,
    );
    assert.equal(approval.externalActivationApproved, false);
    // Authorizes confirmation/login/onboarding only. Sending is independently
    // gated in the signed worker; no mail credential is deployed to this site.
    for (const flag of [
      "BETA_ACCESS_ENABLED",
      "AUTH_EMAIL_ENABLED",
      "DOCKED_AUTH_INVITES_READY",
    ])
      env[flag] = "true";
  }
  assertHostedBeta({
    ...env,
    VERCEL: "1",
    VERCEL_ENV: "preview",
    VERCEL_URL: "docked-production-preflight.vercel.app",
  });
  const source = resolve("private-data/beta-staging-deploy/" + sha + "/source");
  const allowed = (f) =>
    /^(src|public|config|certs)\//.test(f) ||
    [
      "package.json",
      "package-lock.json",
      "next.config.ts",
      "next-env.d.ts",
      "tsconfig.json",
      "vercel.json",
      ".vercelignore",
      "scripts/guard-hosted-build.mjs",
    ].includes(f);
  const files = git("ls-files", "-z")
    .split("\0")
    .filter(Boolean)
    .filter(allowed);
  if (mode === "--prepare") {
    assert.equal(
      git(
        "diff",
        "--name-only",
        "HEAD",
        "--",
        "src",
        "public",
        "config",
        "certs",
        "scripts/guard-hosted-build.mjs",
      ),
      "",
      "Commit web source first",
    );
    assert.equal(
      existsSync(source),
      false,
      "Do not overwrite a prepared export",
    );
    for (const file of files) {
      const destination = join(source, file);
      mkdirSync(dirname(destination), { recursive: true });
      writeFileSync(
        destination,
        execFileSync("git", ["show", `${sha}:${file}`], {
          maxBuffer: 30 * 1024 * 1024,
          windowsHide: true,
        }),
      );
    }
    mkdirSync(join(source, ".vercel"), { recursive: true });
    writeFileSync(
      join(source, ".vercel/project.json"),
      JSON.stringify({
        projectId: project,
        orgId: team,
        projectName: "docked-production",
      }),
    );
    writeFileSync(
      output + "/deployment-prepared.json",
      JSON.stringify(
        {
          commit: sha,
          project,
          team,
          branch,
          target: "preview",
          files: files.length,
          allActivationDisabled: !ownerAuth,
          ownerAuthenticationOnly: ownerAuth,
          source: "committed web-only export",
          preparedAt: new Date().toISOString(),
        },
        null,
        2,
      ) + "\n",
    );
    console.log(
      JSON.stringify({
        prepared: true,
        commit: sha,
        files: files.length,
        target: "preview",
      }),
    );
  } else {
    assert.equal(
      JSON.parse(readFileSync(output + "/deployment-prepared.json", "utf8"))
        .ownerAuthenticationOnly,
      ownerAuth,
    );
    assert.equal(
      JSON.parse(readFileSync(output + "/deployment-prepared.json", "utf8"))
        .commit,
      sha,
    );
    // Source is fixed by commit. Do not override VERCEL_ENV or VERCEL_URL: actual
    // platform values are independently checked by the hosted build/runtime guard.
    const cli = join(
      process.env.LOCALAPPDATA,
      "npm-cache/_npx/67eb4586ca667318/node_modules/vercel/dist/index.js",
    );
    assert.ok(existsSync(cli));
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
      resolve("private-data/vercel-cli"),
      "--meta",
      "githubCommitSha=" + sha,
      "--meta",
      "githubCommitRef=" + branch,
      "--meta",
      "githubCommitOrg=bginty",
      "--meta",
      "githubCommitRepo=docked",
    ];
    for (const [key, value] of Object.entries(env))
      args.push("--env", key + "=" + value, "--build-env", key + "=" + value);
    const r = spawnSync(process.execPath, args, {
      encoding: "utf8",
      windowsHide: true,
      timeout: 180000,
      maxBuffer: 10 * 1024 * 1024,
    });
    // CLI output can echo arguments on errors: retain privately, emit only status.
    writeFileSync(
      "private-data/production/beta-staging-deployment.log",
      String(r.stdout) + String(r.stderr),
      { mode: 0o600 },
    );
    if (r.status !== 0)
      throw Error("CLI deployment failed; inspect redacted private diagnostic");
    const list = await api("/v6/deployments?projectId=" + project + "&limit=5");
    const d = list.deployments.find(
      (d) =>
        d.meta?.githubCommitSha === sha && d.meta?.githubCommitRef === branch,
    );
    assert.ok(d, "Deployment outcome uncertain; inspect before retry");
    if (d.target === "production") {
      await api("/v12/deployments/" + d.uid + "/cancel", { method: "PATCH" });
      throw Error("Unexpected production target cancelled");
    }
    assert.equal(d.target, null);
    const report = {
      id: d.uid,
      url: "https://" + d.url,
      commit: sha,
      project,
      team,
      branch,
      requestedTarget: "preview",
      rawTarget: d.target,
      effectiveTarget: "preview",
      state: d.readyState,
      submittedAt: new Date().toISOString(),
    };
    writeFileSync(
      output + "/deployment-submitted.json",
      JSON.stringify(report, null, 2) + "\n",
    );
    console.log(JSON.stringify(report));
  }
}

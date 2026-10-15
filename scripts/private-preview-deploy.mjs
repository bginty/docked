import { readFile, writeFile, mkdir } from "node:fs/promises";
import { execFileSync, execFile } from "node:child_process";
import { promisify } from "node:util";
import { resolve } from "node:path";
import assert from "node:assert/strict";
import {
  privatePreviewDisabledFlags,
  assertPrivatePreview,
} from "../src/core/private-preview.mjs";
const dir = "private-data/private-preview-release/";
const evidence = "docs/qa/private-preview-release/";
const target = JSON.parse(await readFile("config/hosted-preview.json", "utf8"));
assert.equal(target.projectId, "prj_C3thcg7PjP1Bnn4kR3rk4oRFegYR");
assert.equal(target.teamId, "team_tf6xweKKyVCj9bTppUKttJ4l");
const auth = JSON.parse(
  await readFile("private-data/vercel-cli/auth.json", "utf8"),
);
const git = (...args) =>
  execFileSync("git", args, { encoding: "utf8", windowsHide: true }).trim();
const sha = git("rev-parse", "HEAD");
async function api(route, method = "GET", body) {
  const r = await fetch(
    `https://api.vercel.com${route}${route.includes("?") ? "&" : "?"}teamId=${target.teamId}`,
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
  if (!r.ok) throw Error(`Vercel ${r.status}`);
  return r.json();
}
try {
  const project = await api(`/v9/projects/${target.projectId}`);
  assert.equal(project.name, "docked-preview");
  assert.equal(project.accountId, target.teamId);
  assert.equal(project.ssoProtection?.deploymentType, "all");
  const domains = await api(`/v9/projects/${target.projectId}/domains`);
  assert.ok(domains.domains.every((d) => d.name.endsWith(".vercel.app")));
  const protection = {
    checkedAt: new Date().toISOString(),
    projectId: project.id,
    teamId: project.accountId,
    sso: project.ssoProtection,
    passwordProtection: !!project.passwordProtection,
    productionDomainsAbsent: true,
  };
  await writeFile(
    evidence + "protection.json",
    JSON.stringify(protection, null, 2),
  );
  const mode = process.argv[2];
  if (mode === "--inspect") {
    const entries = (await api(`/v9/projects/${target.projectId}/env`)).envs;
    console.log(
      JSON.stringify({
        ...protection,
        environmentKeys: entries.map((e) => ({
          key: e.key,
          target: e.target,
          branch: e.gitBranch,
          type: e.type,
        })),
      }),
    );
  } else if (mode === "--configure") {
    assert.equal(
      git("branch", "--show-current"),
      "pivot/fantasy-cards-preview-v1",
    );
    const runtime = JSON.parse(
      await readFile(dir + "runtime.private.json", "utf8"),
    );
    const owner = JSON.parse(
      await readFile(dir + "owner.private.json", "utf8"),
    );
    assert.equal(runtime.projectRef, "bckkllmndoxzpzdqrevb");
    assert.equal(owner.email, "support@docked.com.au");
    const env = {
      ...Object.fromEntries(
        privatePreviewDisabledFlags.map((k) => [k, "false"]),
      ),
      DOCKED_PRIVATE_PREVIEW: "true",
      DOCKED_BETA_STAGING: "true",
      VERCEL_ORG_ID: target.teamId,
      VERCEL_PROJECT_ID: target.projectId,
      VERCEL_GIT_COMMIT_REF: "pivot/fantasy-cards-preview-v1",
      VERCEL_GIT_COMMIT_SHA: sha,
      SITE_URL: target.origin,
      APP_ENV: "preview",
      SUPABASE_ENV: "preview",
      DOCKED_RELEASE_CHANNEL: "beta",
      DATABASE_RUNTIME: "serverless",
      DATABASE_URL: runtime.databaseUrl,
      DATABASE_CONNECTION_MODE: runtime.connectionMode,
      NEXT_PUBLIC_SUPABASE_URL: runtime.supabaseUrl,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: runtime.publishableKey,
      DOCKED_PREVIEW_OWNER_EMAIL: owner.email,
      DOCKED_PREVIEW_OWNER_ID: owner.id,
      BETA_ACCESS_ENABLED: "false",
      BETA_TESTERS_ENABLED: "false",
      AUTH_EMAIL_ENABLED: "false",
      DOCKED_AUTH_INVITES_READY: "false",
      FANTASY_FREE_PLAY_PRODUCTION: "false",
      DOCKED_CUSTOMER_ONBOARDING: "false",
      DOCKED_OWNER_GAMEPLAY: "false",
      DOCKED_FRIENDS_PACK_REVEAL: "false",
      DOCKED_PACK_REVEAL_PREVIEW: "false",
      VERCEL_PREVIEW_FEEDBACK_ENABLED: "0",
    };
    assertPrivatePreview({
      ...env,
      VERCEL: "1",
      VERCEL_ENV: "preview",
      VERCEL_URL: "docked-preview-candidate.vercel.app",
    });
    const before = await api(`/v9/projects/${target.projectId}/env`);
    await writeFile(
      dir + "vercel-env-before.private.json",
      JSON.stringify(before),
      { mode: 0o600 },
    );
    const preview = before.envs.filter((e) => e.target?.includes("preview"));
    assert.ok(
      !preview.some((e) => e.gitBranch === env.VERCEL_GIT_COMMIT_REF),
      "Branch-specific overrides require reconciliation",
    );
    // The old Preview web runtime held a privileged Auth key and retired odds
    // credentials. Remove only these exact Preview-only variables. The operator
    // Auth credential stays private locally, never in the deployed web runtime.
    const obsolete = new Set([
      "SUPABASE_SECRET_KEY",
      "THE_ODDS_API_KEY",
      "PROVIDER_TRIAL_OPERATOR_TOKEN",
    ]);
    for (const e of preview.filter(
      (e) => !e.gitBranch && obsolete.has(e.key),
    )) {
      assert.deepEqual(e.target, ["preview"]);
      await api(`/v9/projects/${target.projectId}/env/${e.id}`, "DELETE");
    }
    assert.ok(
      !preview.some(
        (e) =>
          !obsolete.has(e.key) &&
          /^(SUPABASE_SERVICE_ROLE_KEY|MICROSOFT_|GRAPH_|SMTP_|PREVIEW_AUTH_CAPTURE_MODE|PREVIEW_AUTH_PROJECT_REF)/.test(
            e.key,
          ),
      ),
      "Unexpected privileged/capture Preview configuration",
    );
    env.PROVIDER_TRIAL_ENABLED = "false";
    const result = await api(
      `/v10/projects/${target.projectId}/env?upsert=true`,
      "POST",
      Object.entries(env).map(([key, value]) => ({
        key,
        value,
        type: "encrypted",
        target: ["preview"],
      })),
    );
    assert.ok(!result.failed?.length);
    await writeFile(dir + "deployment-env.private.json", JSON.stringify(env), {
      mode: 0o600,
    });
    console.log(
      JSON.stringify({
        configured: true,
        target: "preview",
        commit: sha,
        keys: Object.keys(env),
        productionChanged: false,
      }),
    );
  } else if (mode === "--deploy") {
    const env = JSON.parse(
      await readFile(dir + "deployment-env.private.json", "utf8"),
    );
    assert.equal(env.VERCEL_GIT_COMMIT_SHA, sha);
    const manifest = JSON.parse(
      await readFile(
        `private-data/hosted-deploy/${sha}/source-manifest.json`,
        "utf8",
      ),
    );
    assert.equal(manifest.commit, sha);
    assert.equal(manifest.projectId, target.projectId);
    await mkdir(resolve(manifest.sourceDirectory, ".vercel"), {
      recursive: true,
    });
    await writeFile(
      resolve(manifest.sourceDirectory, ".vercel/project.json"),
      JSON.stringify({
        orgId: target.teamId,
        projectId: target.projectId,
        projectName: "docked-preview",
      }),
    );
    const args = [
      "C:/Users/61412/AppData/Local/npm-cache/_npx/67eb4586ca667318/node_modules/vercel/dist/index.js",
      "deploy",
      "--cwd",
      manifest.sourceDirectory,
      "--global-config",
      resolve("private-data/vercel-cli"),
      "--target",
      "preview",
      "--yes",
      "--no-wait",
      "--meta",
      `dockedSourceCommit=${sha}`,
    ];
    const result = await promisify(execFile)(process.execPath, args, {
      windowsHide: true,
      maxBuffer: 8e6,
      timeout: 180000,
    });
    await writeFile(
      dir + "deployment-cli.private.log",
      result.stdout + "\n" + result.stderr,
      { mode: 0o600 },
    );
    const urls = [
      ...result.stdout.matchAll(
        /https:\/\/(docked-preview-[a-z0-9-]+\.vercel\.app)/g,
      ),
    ];
    assert.ok(urls.length);
    const d = await api(`/v13/deployments/${urls.at(-1)[1]}`);
    assert.equal(d.projectId, target.projectId);
    assert.equal(d.target, null);
    assert.equal(d.meta?.dockedSourceCommit, sha);
    const record = {
      id: d.id,
      url: "https://" + d.url,
      commit: sha,
      target: "preview",
      state: d.readyState,
    };
    await writeFile(
      evidence + "deployment-submitted.json",
      JSON.stringify(record, null, 2),
    );
    console.log(JSON.stringify(record));
  } else if (mode === "--record-rollback") {
    const alias = await api(`/v4/aliases/${new URL(target.origin).hostname}`);
    assert.equal(alias.projectId, target.projectId);
    const record = {
      origin: target.origin,
      projectId: alias.projectId,
      deploymentId: alias.deploymentId ?? alias.deployment?.id,
      recordedAt: new Date().toISOString(),
      instruction:
        "Restore application alias only; preserve subsequent Auth, ledger and receipt history.",
    };
    assert.match(record.deploymentId, /^dpl_/);
    await writeFile(
      evidence + "rollback.json",
      JSON.stringify(record, null, 2),
      { flag: "wx" },
    );
    console.log(JSON.stringify(record));
  } else if (mode === "--status") {
    const saved = JSON.parse(
      await readFile(evidence + "deployment-submitted.json", "utf8"),
    );
    const d = await api(`/v13/deployments/${saved.id}`);
    assert.equal(d.projectId, target.projectId);
    assert.equal(d.target, null);
    assert.equal(d.meta?.dockedSourceCommit, saved.commit);
    const record = {
      ...saved,
      state: d.readyState,
      checkedAt: new Date().toISOString(),
    };
    await writeFile(
      evidence + "deployment-status.json",
      JSON.stringify(record, null, 2),
    );
    console.log(JSON.stringify(record));
  } else throw Error("Unknown mode");
} catch (e) {
  console.error(
    JSON.stringify({
      failed: true,
      code: e.code ?? e.name,
      reason: /^Vercel \d{3}$/.test(e.message)
        ? e.message
        : "Preview operation stopped; reconcile private evidence",
    }),
  );
  process.exitCode = 1;
}

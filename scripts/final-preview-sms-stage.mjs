/** Exact previously approved source, existing protected Preview, phone-only
 * runtime window. Never enables Supabase Phone or sends a message. */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import {
  packet,
  hash,
  sourceCommit,
  privateDir,
} from "./lib/final-phone-preparation.mjs";
import {
  assertIsolatedPublicPreview,
  isolatedPhoneTestIdentity,
} from "../src/core/isolated-public-preview.mjs";
const mode = process.argv[2];
assert(["prepare", "stage", "status", "verify"].includes(mode));
const folder = path.resolve("private-data/phone-acceptance-20261117");
const evidence = path.resolve("docs/qa/phone-acceptance-20261117");
const source = privateDir + "/preview-source";
const project = "prj_C3thcg7PjP1Bnn4kR3rk4oRFegYR";
const p = packet();
const read = (f) => JSON.parse(fs.readFileSync(f, "utf8"));
const write = (f, v) =>
  fs.writeFileSync(f, JSON.stringify(v, null, 2) + "\n", {
    flag: "wx",
    mode: 0o600,
  });
const authDir =
  "C:/Users/61412/Documents/ChatGPT/Docked.com.au/private-data/vercel-cli";
const token = read(authDir + "/auth.json").token;
const cli =
  "C:/Users/61412/AppData/Local/npm-cache/_npx/67eb4586ca667318/node_modules/vercel/dist/index.js";
const approvedDigest =
  "e7a570ecbfce5a82438117d2e0174649e0e55ea399f5f3b8c46d2e338413b41e";
async function api(route) {
  const r = await fetch(
    "https://api.vercel.com" + route + "?teamId=" + p.teamId,
    {
      headers: { Authorization: "Bearer " + token },
      redirect: "error",
      signal: AbortSignal.timeout(30000),
    },
  );
  assert(r.ok, "Vercel metadata unavailable");
  return r.json();
}
async function command(args, env = {}) {
  try {
    return await promisify(execFile)(
      process.execPath,
      [cli, ...args, "--global-config", authDir, "--scope", p.teamId],
      {
        cwd: source,
        env: { ...process.env, ...env },
        windowsHide: true,
        timeout: 240000,
        maxBuffer: 16e6,
      },
    );
  } catch (e) {
    fs.writeFileSync(
      folder + "/cli-error.private.log",
      String(e.stdout ?? "") + String(e.stderr ?? ""),
      { mode: 0o600 },
    );
    throw Error("Preview staging stopped; private diagnostic retained");
  }
}
function verifyBytes() {
  const bytes = fs.readFileSync(
    "docs/qa/final-commercial-20261116/preview-sms-package.json",
  );
  assert.equal(hash(bytes), approvedDigest);
  const manifest = JSON.parse(bytes);
  assert.equal(manifest.sourceCommit, sourceCommit);
  for (const f of manifest.files)
    assert.equal(hash(fs.readFileSync(f.file)), f.sha256);
  for (const f of p.sourceFiles)
    assert.equal(
      hash(fs.readFileSync(path.join(source, f.file))),
      f.sha256,
      "Export source mismatch",
    );
  assert.equal(read(source + "/.vercel/project.json").projectId, project);
}
async function main() {
  fs.mkdirSync(folder, { recursive: true });
  fs.mkdirSync(evidence, { recursive: true });
  verifyBytes();
  const projectInfo = await api("/v9/projects/" + project);
  assert.equal(projectInfo.id, project);
  assert.equal(projectInfo.ssoProtection?.deploymentType, "all");
  if (mode === "prepare") {
    const attested = read(folder + "/attended-authority.private.json");
    assert.equal(attested.packageSha256, approvedDigest);
    assert.equal(attested.founderAvailable, true);
    assert(Date.parse(attested.expiresAt) > Date.now() + 2 * 3600000);
    const raw = fs.readFileSync(
      privateDir + "/phone-test/identities.prepared.private.json",
    );
    assert.equal(
      hash(raw),
      "6163d6bb3693b643e02a6f989a20048d7f57654297c7d85a6afd60bde30f8935",
    );
    const ids = JSON.parse(raw);
    assert.equal(ids.projectRef, "bckkllmndoxzpzdqrevb");
    assert.equal(ids.accounts.length, 2);
    const startsAt = new Date().toISOString(),
      until = new Date(Date.parse(startsAt) + 2 * 3600000).toISOString();
    const members = ids.accounts
      .map((a) => a.userId)
      .sort()
      .join(",");
    const env = {
      ...read(privateDir + "/preview-runtime.private.json"),
      DOCKED_ISOLATED_PHONE_TEST: "true",
      DOCKED_PUBLIC_PHONE_OTP: "true",
      DOCKED_ISOLATED_PHONE_MEMBERS: members,
      DOCKED_ISOLATED_PHONE_UNTIL: until,
      DOCKED_PUBLIC_PHONE_POLICY_REFERENCE: "2026-11-11-privacy-phone-v4",
    };
    const check = {
      ...env,
      VERCEL: "1",
      VERCEL_ENV: "preview",
      VERCEL_TARGET_ENV: "preview",
      VERCEL_URL: "docked-preview-acceptance.vercel.app",
    };
    assert(assertIsolatedPublicPreview(check));
    for (const a of ids.accounts)
      assert(isolatedPhoneTestIdentity(check, a.userId));
    assert(
      !isolatedPhoneTestIdentity(check, "00000000-0000-4000-8000-000000000000"),
    );
    assert.throws(() =>
      assertIsolatedPublicPreview({ ...check, VERCEL_ENV: "production" }),
    );
    assert.throws(() =>
      assertIsolatedPublicPreview(check, Date.parse(until) + 1),
    );
    const plan = {
      schemaVersion: 1,
      projectRef: ids.projectRef,
      organizationId: "ernfnkcbalhyqpsrzdwa",
      sourceCommit,
      memberSetSha256: hash(members),
      startsAt,
      until,
      maximumAttempts: 6,
      maximumSegments: 20,
      maximumAud: 5,
      cumulativeMaximumAud: 20,
      attended: true,
      signupEnabled: false,
    };
    write(folder + "/phone-window.json", plan);
    write(folder + "/phone-window-authority.private.json", {
      approved: true,
      planSha256: hash(fs.readFileSync(folder + "/phone-window.json")),
      approvedAt: attested.authorityAnchor,
      expiresAt: attested.expiresAt,
      basis: attested.basis,
    });
    write(folder + "/runtime.private.json", env);
    write(evidence + "/window-prepared.json", {
      ...plan,
      packageSha256: approvedDigest,
      providerEnabled: false,
      productionChanged: false,
      expiryAndAccountGuardsPassed: true,
    });
    console.log(
      JSON.stringify({ prepared: true, until, providerEnabled: false }),
    );
  } else if (mode === "stage") {
    assert(
      !fs.existsSync(evidence + "/deployment.json"),
      "Never duplicate an existing deployment",
    );
    const env = read(folder + "/runtime.private.json"),
      plan = read(folder + "/phone-window.json");
    assert(Date.parse(plan.until) > Date.now() + 20 * 60000);
    assert(
      fs.existsSync(folder + "/phone-window-armed.json"),
      "Watchdog must be armed",
    );
    assert(
      !fs.existsSync(folder + "/STOP") &&
        !fs.existsSync(folder + "/phone-window-result.json"),
    );
    const inspected = await command([
      "project",
      "inspect",
      "--non-interactive",
    ]);
    assert((inspected.stdout + inspected.stderr).includes(project));
    const args = [
      "deploy",
      "--cwd",
      source,
      "--yes",
      "--no-wait",
      "--meta",
      "githubCommitSha=" + sourceCommit,
      "--meta",
      "githubCommitRef=codex/batch1-pack-phone-20261116",
    ];
    for (const key of Object.keys(env))
      args.push("--env", key, "--build-env", key);
    const result = await command(args, env);
    fs.writeFileSync(
      folder + "/deploy.private.log",
      result.stdout + "\n" + result.stderr,
      { mode: 0o600 },
    );
    const url = [
      ...result.stdout.matchAll(
        /https:\/\/docked-preview-[a-z0-9-]+\.vercel\.app/g,
      ),
    ]
      .map((v) => v[0])
      .at(-1);
    assert(url);
    const d = await api("/v13/deployments/" + new URL(url).hostname);
    assert.equal(d.projectId, project);
    assert.notEqual(d.target, "production");
    assert.equal(d.meta.githubCommitSha, sourceCommit);
    write(evidence + "/deployment.json", {
      at: new Date().toISOString(),
      id: d.id,
      url,
      sourceCommit,
      until: plan.until,
      providerEnabled: false,
      productionChanged: false,
    });
    console.log(JSON.stringify({ id: d.id, url, state: d.readyState }));
  } else {
    const prior = read(evidence + "/deployment.json"),
      d = await api("/v13/deployments/" + prior.id);
    assert.equal(d.projectId, project);
    assert.notEqual(d.target, "production");
    assert.equal(d.meta.githubCommitSha, sourceCommit);
    if (mode === "verify") {
      assert.equal(d.readyState, "READY");
      assert(Date.parse(prior.until) > Date.now() + 10 * 60000);
      const checks = [];
      for (const item of [
        { route: "/app/login?next=/app/verify-phone", status: 200 },
        { route: "/privacy", status: 200 },
        { route: "/api/store/google/commercial", status: 403 },
        {
          route: "/api/auth/phone",
          status: 403,
          origin: "https://invalid.example",
        },
        { route: "/api/auth/phone", status: 400, origin: prior.url },
      ]) {
        const args = [
          cli,
          "curl",
          item.route,
          "--deployment",
          prior.url,
          "--",
          "--silent",
          "--show-error",
          "--max-time",
          "40",
          "--write-out",
          "\nDOCKED_STATUS:%{http_code} TIME:%{time_total}",
        ];
        if (item.origin)
          args.push(
            "--request",
            "POST",
            "--header",
            "Origin: " + item.origin,
            "--header",
            "Content-Type: application/json",
            "--data",
            "{}",
          );
        const result = await promisify(execFile)(process.execPath, args, {
          cwd: source,
          env: { ...process.env, VERCEL_TOKEN: token },
          windowsHide: true,
          timeout: 55000,
          maxBuffer: 8e6,
        });
        const status = Number(result.stdout.match(/DOCKED_STATUS:(\d+)/)?.[1]);
        checks.push({
          route: item.route,
          status,
          expected: item.status,
          seconds: Number(result.stdout.match(/TIME:([\d.]+)/)?.[1]),
          anonymous: true,
          wrongOrigin: item.origin === "https://invalid.example",
        });
        assert.equal(status, item.status, "Hosted gate response mismatch");
        if (item.route === "/privacy")
          assert(result.stdout.includes("2026-11-11-privacy-phone-v4"));
        if (item.status === 400)
          assert(result.stdout.includes("Authentication required"));
      }
      write(evidence + "/hosted-preflight.json", {
        at: new Date().toISOString(),
        passed: true,
        sourceCommit,
        deployment: d.id,
        checks,
        productionChanged: false,
        smsAttempts: 0,
      });
    }
    console.log(
      JSON.stringify({
        id: d.id,
        url: prior.url,
        state: d.readyState,
        until: prior.until,
      }),
    );
  }
}
main().catch(() => {
  console.error(
    "Preview-only staging stopped. No Phone enable or SMS action is present in this operator.",
  );
  process.exitCode = 1;
});

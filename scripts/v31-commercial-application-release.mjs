// Closed-gate application operator. Exact approved Git bytes; no gate changes.
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { execFile, execFileSync } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import {
  authority,
  packet,
  blob,
  git,
  root,
  evidence,
  privateDir,
  hash,
  readJson,
  writeEvidence,
  writePrivate,
  sourceCommit,
  packageSha256,
} from "./lib/v31-commercial-approval.mjs";
const p = packet(),
  mode = process.argv[2];
assert(
  [
    "prepare",
    "preflight",
    "stage",
    "verify-staging",
    "promote",
    "verify-live",
  ].includes(mode),
);
const source = privateDir + "/source";
const authDir =
  "C:/Users/61412/Documents/ChatGPT/Docked.com.au/private-data/vercel-cli";
const auth = readJson(authDir + "/auth.json");
const cli =
  "C:/Users/61412/AppData/Local/npm-cache/_npx/67eb4586ca667318/node_modules/vercel/dist/index.js";
const base = readJson(
  "C:/Users/61412/.codex/worktrees/v31-phone-privacy-candidate-20261112/Docked.com.au/private-data/nba-production/" +
    p.baseCommit +
    "/runtime.private.json",
);
assert.equal(hash(JSON.stringify(base)), p.baselineRuntimeRecipeSha256);
assert.equal(Object.keys(base).length, 89);
const branch = "codex/v31-founder-acceptance-20261111";
async function inspect(host) {
  const r = await fetch(
    "https://api.vercel.com/v13/deployments/" + host + "?teamId=" + p.teamId,
    {
      headers: { Authorization: "Bearer " + auth.token },
      signal: AbortSignal.timeout(30000),
    },
  );
  assert(r.ok, "Deployment inspection failed: " + r.status);
  const d = await r.json();
  assert.equal(d.projectId, p.projectId);
  return d;
}
async function command(args, extra = {}) {
  try {
    return await promisify(execFile)(
      process.execPath,
      [cli, ...args, "--global-config", authDir, "--scope", p.teamId],
      {
        cwd: source,
        env: { ...process.env, ...extra },
        windowsHide: true,
        timeout: 240000,
        maxBuffer: 16e6,
      },
    );
  } catch (e) {
    await fs.writeFile(
      privateDir + "/application-error.private.log",
      String(e.stdout ?? "") + "\n" + String(e.stderr ?? ""),
      { mode: 0o600 },
    );
    throw Error("Vercel command failed; private diagnostic retained");
  }
}
async function exactFiles(write = false) {
  const extra = [".vercelignore", "next-env.d.ts"].filter((f) =>
    git("ls-tree", "--name-only", sourceCommit, "--", f).toString().trim(),
  );
  const files = [
    ...p.sourceFiles,
    ...extra.map((file) => ({ file, sha256: hash(blob(file)) })),
  ];
  const buffers = execFileSync("git", ["cat-file", "--batch"], {
    cwd: root,
    input: files.map((x) => sourceCommit + ":" + x.file).join("\n") + "\n",
    windowsHide: true,
    maxBuffer: 256e6,
  });
  let offset = 0;
  for (const f of files) {
    assert(!f.file.includes(".."));
    const end = buffers.indexOf(10, offset);
    const header = buffers.subarray(offset, end).toString();
    assert.match(header, /^[a-f0-9]+ blob \d+$/);
    const size = Number(header.split(" ")[2]);
    const bytes = buffers.subarray(end + 1, end + 1 + size);
    assert.equal(hash(bytes), f.sha256, f.file);
    const target = path.join(source, f.file);
    if (write) {
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.writeFile(target, bytes, { flag: "wx" });
    } else
      assert.equal(
        hash(await fs.readFile(target)),
        f.sha256,
        "Changed export: " + f.file,
      );
    offset = end + 2 + size;
  }
  assert.equal(offset, buffers.length);
  return files.length;
}
function runtime() {
  const secrets = readJson(privateDir + "/runtime-initial.private.json");
  assert.deepEqual(
    Object.keys(secrets).sort(),
    [
      "DOCKED_COMMERCIAL_DATABASE_URL",
      "DOCKED_COMMERCIAL_REFERENCE_KEY_ID",
      "DOCKED_COMMERCIAL_REFERENCE_KEY",
      "DOCKED_COMMERCIAL_ACCOUNT_BINDING_SECRET",
      "DOCKED_GOOGLE_COMMERCIAL_SERVICE_EMAIL",
      "DOCKED_GOOGLE_COMMERCIAL_PRIVATE_KEY",
      "DOCKED_GOOGLE_COMMERCIAL_WORKER_SECRET",
    ].sort(),
  );
  const r = {
    ...base,
    ...secrets,
    DOCKED_COMMERCIAL_MARKETPLACE: "false",
    VERCEL_GIT_COMMIT_SHA: sourceCommit,
  };
  for (const [k, v] of Object.entries(base))
    if (k !== "VERCEL_GIT_COMMIT_SHA")
      assert.equal(r[k], v, "Runtime changed: " + k);
  for (const key of [
    "REGISTRATION_ENABLED",
    "COMPETITIONS_ENABLED",
    "PRIZES_ENABLED",
    "DOCKED_COMMERCIAL_SERVICE",
    "DOCKED_COMMERCIAL_SURFACES",
    "DOCKED_COMMERCIAL_CHECKOUT",
    "DOCKED_COMMERCIAL_MARKETPLACE",
    "DOCKED_PUBLIC_CUSTOMERS",
    "DOCKED_MEMBER_GOOGLE_TEST",
    "DOCKED_MULTI_SPORT_SANDBOX",
    "DOCKED_PUBLIC_PHONE_OTP",
    "DOCKED_ISOLATED_PHONE_TEST",
  ])
    assert.equal(r[key], "false", key);
  assert.equal(r.VERCEL_GIT_COMMIT_REF, "codex/vercel-beta-review");
  assert.equal(r.DOCKED_PUBLIC_PRIVACY_VERSION, "2026-11-11-privacy-phone-v4");
  return r;
}
async function dbCheck(label) {
  const output = execFileSync(
    process.execPath,
    [
      "--import",
      "tsx",
      "scripts/v31-commercial-database-execution.ts",
      "verify",
    ],
    { cwd: root, windowsHide: true, timeout: 120000, maxBuffer: 4e6 },
  ).toString();
  const result = JSON.parse(output.trim());
  assert.equal(result.verified, true);
  const applied = readJson(evidence + "/database-applied.json");
  assert.deepEqual(result.schema, applied.schemaAfter);
  writeEvidence(label + "-database.json", {
    at: new Date().toISOString(),
    ...result,
  });
  return result;
}
async function preflight(label) {
  const live = await inspect("docked.com.au");
  assert.equal(live.id, p.baselineDeployment);
  assert.equal(live.meta.githubCommitSha, p.baseCommit);
  for (const key of Object.keys(base))
    assert(live.env.includes(key), "Missing baseline key: " + key);
  assert.deepEqual(
    live.crons,
    readJson(privateDir + "/baseline-deployment.private.json").crons,
  );
  const count = await exactFiles();
  const link = readJson(source + "/.vercel/project.json");
  assert.equal(link.projectId, p.projectId);
  assert.equal(link.orgId, p.teamId);
  const r = runtime();
  assert.equal(
    hash(JSON.stringify(r)),
    hash(
      JSON.stringify(readJson(privateDir + "/runtime-deployment.private.json")),
    ),
  );
  const inspected = await command(["project", "inspect", "--non-interactive"]);
  assert(
    (inspected.stdout + inspected.stderr).includes(p.projectId),
    "CLI linked project did not match",
  );
  await dbCheck(label);
  const v = readJson(evidence + "/runtime-verified.json");
  assert.equal(v.sourceCommit, sourceCommit);
  assert.equal(v.productionWrites, 0);
  writeEvidence(label + "-preflight.json", {
    at: new Date().toISOString(),
    sourceCommit,
    packageSha256,
    baseline: live.id,
    exportedFiles: count,
    preservedRuntimeSettings: 89,
    sourceMetadataChanged: true,
    initialServerSecrets: 7,
    marketplaceExplicitlyDisabled: true,
    runtimeRecipeSha256: hash(JSON.stringify(r)),
    cronsUnchanged: true,
  });
}
async function http(target, route, method, live) {
  if (live) {
    const r = await fetch(target + route, {
      method,
      redirect: "manual",
      signal: AbortSignal.timeout(45000),
      ...(method === "POST"
        ? {
            headers: {
              Origin: "https://invalid.example",
              "Content-Type": "application/json",
            },
            body: "{}",
          }
        : {}),
    });
    return {
      status: r.status,
      body: await r.text(),
      headers: Object.fromEntries(r.headers),
    };
  }
  const args = [
    cli,
    "curl",
    route,
    "--deployment",
    target,
    "--",
    "--silent",
    "--show-error",
    "--include",
    "--max-time",
    "45",
    "--write-out",
    "\nDOCKED_STATUS:%{http_code}",
  ];
  if (method === "POST")
    args.push(
      "--request",
      "POST",
      "--header",
      "Origin: https://invalid.example",
      "--header",
      "Content-Type: application/json",
      "--data",
      "{}",
    );
  const { stdout } = await promisify(execFile)(process.execPath, args, {
    cwd: source,
    env: { ...process.env, VERCEL_TOKEN: auth.token },
    windowsHide: true,
    timeout: 55000,
    maxBuffer: 8e6,
  });
  return {
    status: Number(stdout.match(/DOCKED_STATUS:(\d+)/)?.[1]),
    body: stdout,
    headers: {},
  };
}
async function verify(live) {
  const receipt = readJson(evidence + "/deployment-submitted.json");
  const target = live ? "https://docked.com.au" : receipt.url;
  const d = await inspect(new URL(target).hostname);
  assert.equal(d.id, receipt.id);
  assert.equal(d.readyState, "READY");
  assert.equal(d.meta.githubCommitSha, sourceCommit);
  assert.equal(d.meta.githubCommitRef, branch);
  const r = runtime();
  for (const key of Object.keys(r))
    assert(d.env.includes(key), "Missing candidate key: " + key);
  assert.deepEqual(
    d.crons,
    readJson(privateDir + "/baseline-deployment.private.json").crons,
  );
  const cases = [
    ["/api/beta-release", 200],
    ["/app/login", 200],
    ["/app/signup", 200],
    ["/app/invitation-setup", 200],
    ["/privacy", 200],
    ["/commercial-policy", 200],
    ["/refund-policy", 200],
    ["/retention", 200],
    ["/account-deletion", 200],
    ["/api/store/google/commercial", 403],
    ["/api/workspace-wallet", 403],
    ["/api/mobile/capabilities", 401],
    ...["nfl", "afl", "nrl", "basketball"].map((s) => [
      "/api/public-gameplay?sport=" + s,
      403,
    ]),
    ...["nfl", "afl", "nrl", "basketball"].map((s) => [
      "/api/fantasy/scoring-history?sport=" + s,
      s === "basketball" ? 400 : 401,
    ]),
    ["/profile/qa_billing", 503],
    ["/preview/pack-opening", 404],
    ["/api/admin/incidents", 403],
    ["/admin/incidents", 200],
    ["/api/admin/incidents", 403, "POST"],
    ["/api/auth/phone", 403, "POST"],
  ];
  const checks = [];
  const assets = new Set();
  const secretValues = Object.entries(r).filter(
    ([key, value]) =>
      /SECRET|PRIVATE_KEY|REFERENCE_KEY$|BINDING_SECRET|DATABASE_URL/.test(
        key,
      ) && value.length > 16,
  );
  const scan = (body) => {
    for (const [key, value] of secretValues)
      for (const form of [
        value,
        JSON.stringify(value).slice(1, -1),
        encodeURIComponent(value),
      ])
        assert(!body.includes(form), "Server secret exposure: " + key);
  };
  let cursor = 0;
  await Promise.all(
    Array.from({ length: 3 }, async () => {
      while (cursor < cases.length) {
        const [route, status, method = "GET"] = cases[cursor++];
        const response = await http(target, route, method, live);
        for (const match of response.body.matchAll(
          /(?:src|href)="(\/_next\/static\/[^"?]+\.(?:js|css))(?:\?[^\"]*)?"/g,
        ))
          assets.add(match[1]);
        scan(response.body);
        assert.equal(response.status, status, route);
        const header = (k) =>
          response.headers[k] ??
          response.body.match(new RegExp(k + ":\\s*([^\\r\\n]+)", "i"))?.[1] ??
          "";
        if (route === "/api/beta-release") {
          assert(response.body.includes(sourceCommit));
          assert(response.body.includes('"publicRegistration":false'));
        }
        if (route === "/app/login")
          assert(response.body.includes("Welcome back"));
        if (route === "/app/invitation-setup")
          assert(response.body.includes("Log in to an existing account"));
        if (route === "/privacy")
          for (const t of [
            r.DOCKED_PUBLIC_PRIVACY_VERSION,
            "Twilio",
            "400 days",
            "30 days",
            "United States",
            "Singapore",
            "per-session identifier",
            "Account-deletion requests remain available",
            "90-day",
            "Supabase Auth",
          ])
            assert(response.body.includes(t), "Missing privacy wording: " + t);
        if (route.startsWith("/api/fantasy/scoring-history")) {
          assert(header("cache-control").includes("private"));
          assert(header("cache-control").includes("no-store"));
          assert(response.body.includes("Scoring history is unavailable"));
        }
        if (route === "/api/admin/incidents") {
          assert(header("cache-control").includes("no-store"));
          assert(header("x-content-type-options").includes("nosniff"));
        }
        if (route === "/api/auth/phone")
          assert(response.body.includes("Origin denied"));
        for (const [key, value] of Object.entries(r).filter(
          ([key, value]) =>
            /SECRET|PRIVATE_KEY|REFERENCE_KEY$|BINDING_SECRET|DATABASE_URL/.test(
              key,
            ) && value.length > 16,
        ))
          assert(
            !response.body.includes(value),
            "Server secret exposure: " + key,
          );
        checks.push({ route, method, status, pass: true });
      }
    }),
  );
  const assetList = [...assets];
  assert(assetList.length > 0, "No delivered browser assets discovered");
  let assetIndex = 0;
  await Promise.all(
    Array.from({ length: 3 }, async () => {
      while (assetIndex < assetList.length) {
        const route = assetList[assetIndex++];
        const response = await http(target, route, "GET", live);
        assert.equal(response.status, 200, route);
        scan(response.body);
      }
    }),
  );
  await dbCheck(live ? "postflight" : "staging");
  writeEvidence(
    live ? "production-verification.json" : "staging-verification.json",
    {
      at: new Date().toISOString(),
      sourceCommit,
      packageSha256,
      deployment: d.id,
      target,
      live,
      httpChecks: checks.length,
      deliveredBrowserAssetsScanned: assetList.length,
      exactRuntimeSecretValuesAbsent: true,
      checks: checks.sort((a, b) =>
        (a.route + a.method).localeCompare(b.route + b.method),
      ),
      runtimeSettings: Object.keys(r).length,
      runtimeRecipeSha256: hash(JSON.stringify(r)),
      hostedSecretValuesReadBack: false,
      cronsUnchanged: true,
      smsSent: false,
      playPublished: false,
      financialMutations: 0,
    },
  );
  console.log(
    JSON.stringify({
      verified: true,
      live,
      sourceCommit,
      deployment: d.id,
      httpChecks: checks.length,
    }),
  );
}
async function main() {
  if (mode === "prepare") {
    authority("protected-stage");
    const d = await inspect("docked.com.au");
    assert.equal(d.id, p.baselineDeployment);
    assert.equal(d.meta.githubCommitSha, p.baseCommit);
    const files = await exactFiles(true);
    await fs.mkdir(source + "/.vercel", { recursive: true });
    await fs.writeFile(
      source + "/.vercel/project.json",
      JSON.stringify({
        projectId: p.projectId,
        orgId: p.teamId,
        projectName: "docked-production",
      }),
      { flag: "wx" },
    );
    writePrivate("baseline-deployment.private.json", {
      id: d.id,
      source: d.meta.githubCommitSha,
      crons: d.crons,
    });
    const r = runtime();
    writePrivate("runtime-deployment.private.json", r);
    writeEvidence("application-prepared.json", {
      at: new Date().toISOString(),
      sourceCommit,
      packageSha256,
      files,
      runtimeSettings: Object.keys(r).length,
      runtimeRecipeSha256: hash(JSON.stringify(r)),
      sourceTree: p.sourceTree,
    });
    console.log("Exact source and closed runtime prepared");
  }
  if (mode === "preflight") await preflight("application");
  if (mode === "stage") {
    authority("protected-stage");
    assert(
      !(await fs
        .stat(evidence + "/deployment-submitted.json")
        .catch(() => null)),
      "Deployment already submitted",
    );
    await preflight("stage");
    const r = runtime();
    const args = [
      "deploy",
      "--cwd",
      source,
      "--prod",
      "--skip-domain",
      "--yes",
      "--no-wait",
      "--meta",
      "dockedSourceCommit=" + sourceCommit,
      "--meta",
      "githubCommitSha=" + sourceCommit,
      "--meta",
      "githubCommitRef=" + branch,
    ];
    for (const key of Object.keys(r))
      args.push("--env", key, "--build-env", key);
    const result = await command(args, r);
    await fs.writeFile(
      privateDir + "/deploy.private.log",
      result.stdout + "\n" + result.stderr,
      { mode: 0o600 },
    );
    const urls = [
      ...result.stdout.matchAll(
        /https:\/\/docked-production-[a-z0-9-]+\.vercel\.app/g,
      ),
    ].map((x) => x[0]);
    assert(urls.length);
    const url = urls.at(-1);
    const d = await inspect(new URL(url).hostname);
    assert.equal(d.meta.githubCommitSha, sourceCommit);
    const receipt = {
      at: new Date().toISOString(),
      sourceCommit,
      packageSha256,
      url,
      id: d.id,
      projectId: p.projectId,
      domainAssigned: false,
    };
    writeEvidence("deployment-submitted.json", receipt);
    console.log(JSON.stringify(receipt));
  }
  if (mode === "verify-staging") await verify(false);
  if (mode === "promote") {
    authority("verified-promotion");
    const v = readJson(evidence + "/staging-verification.json");
    assert.equal(v.sourceCommit, sourceCommit);
    assert.equal(v.packageSha256, packageSha256);
    assert.equal(v.httpChecks, 26);
    assert(v.checks.every((x) => x.pass));
    assert(Date.now() - Date.parse(v.at) < 1800000);
    await preflight("promotion");
    const receipt = readJson(evidence + "/deployment-submitted.json");
    const d = await inspect(new URL(receipt.url).hostname);
    assert.equal(d.id, v.deployment);
    assert.equal(d.readyState, "READY");
    assert.equal(d.meta.githubCommitSha, sourceCommit);
    await command(["promote", receipt.url, "--cwd", source, "--yes"]);
    const live = await inspect("docked.com.au");
    assert.equal(live.id, d.id);
    writeEvidence("deployment-promoted.json", {
      ...receipt,
      at: new Date().toISOString(),
      domainAssigned: true,
      domain: "https://docked.com.au",
    });
    console.log(
      JSON.stringify({ promoted: true, sourceCommit, deployment: live.id }),
    );
  }
  if (mode === "verify-live") await verify(true);
}
main().catch(async (e) => {
  await fs.writeFile(privateDir + "/application-stop.private.txt", String(e), {
    mode: 0o600,
  });
  console.error(
    "Application operator stopped; private diagnostic retained. No automatic retry or promotion.",
  );
  process.exitCode = 1;
});

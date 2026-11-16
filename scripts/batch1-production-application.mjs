/** Exact approved Production-target stage/promotion. No project/env mutation. */
import assert from "node:assert/strict";
import fs from "node:fs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import {
  authority,
  packet,
  source,
  packageSha,
  addendumSha,
  priv,
  docs,
  json,
  save,
  sha,
  verifyExport,
} from "./lib/batch1-production-execution.mjs";
const mode = process.argv[2];
assert(
  ["preflight", "stage", "status", "smoke", "promote", "postflight"].includes(
    mode,
  ),
);
authority();
const p = packet();
const authDir =
    "C:/Users/61412/Documents/ChatGPT/Docked.com.au/private-data/vercel-cli",
  token = json(authDir + "/auth.json").token,
  cli =
    "C:/Users/61412/AppData/Local/npm-cache/_npx/67eb4586ca667318/node_modules/vercel/dist/index.js",
  cwd = priv + "/source";
const original = json(
  "C:/Users/61412/.codex/worktrees/v31-founder-acceptance-20261111/Docked.com.au/private-data/brenton-execution-20261115/runtime-deployment.private.json",
);
assert.equal(
  sha(JSON.stringify(original)),
  "f0261e9f4ff84c625f9d076489cf466cd065abc58fd2361a32984eb878dc96a6",
);
const runtime = { ...original, VERCEL_GIT_COMMIT_SHA: source };
async function api(route) {
  const r = await fetch(
    "https://api.vercel.com" +
      route +
      (route.includes("?") ? "&" : "?") +
      "teamId=" +
      p.teamId,
    {
      headers: { Authorization: "Bearer " + token },
      signal: AbortSignal.timeout(30000),
      redirect: "error",
    },
  );
  assert(r.ok, "Vercel API status " + r.status);
  return r.json();
}
const inspect = (host) => api("/v13/deployments/" + host);
async function command(args, env = {}) {
  try {
    return await promisify(execFile)(
      process.execPath,
      [cli, ...args, "--global-config", authDir, "--scope", p.teamId],
      {
        cwd,
        env: { ...process.env, ...env, VERCEL_TOKEN: token },
        windowsHide: true,
        timeout: 240000,
        maxBuffer: 16e6,
      },
    );
  } catch (e) {
    fs.writeFileSync(
      priv + "/application-command-error.private.log",
      String(e.stdout ?? "") + "\n" + String(e.stderr ?? ""),
    );
    throw Error("Vercel command stopped; private diagnostic retained");
  }
}
async function bindings() {
  const project = await api("/v9/projects/" + p.projectId);
  assert.equal(project.accountId, p.teamId);
  assert.equal(project.nodeVersion, "22.x");
  assert.equal(
    project.ssoProtection?.deploymentType,
    "all_except_custom_domains",
  );
  const env = await api("/v9/projects/" + p.projectId + "/env?decrypt=true");
  assert.equal(env.hiddenProductionEnvCount, 0);
  const current = env.envs.filter((e) => e.target.includes("production")),
    before = json(priv + "/project-env.private.json").envs.filter((e) =>
      e.target.includes("production"),
    );
  const metadata = (rows) =>
    rows
      .map(
        ({
          id,
          key,
          type,
          target,
          createdAt,
          updatedAt,
          configurationId,
          gitBranch,
        }) => ({
          id,
          key,
          type,
          target,
          createdAt,
          updatedAt,
          configurationId,
          gitBranch,
        }),
      )
      .sort((a, b) => a.key.localeCompare(b.key));
  assert.deepEqual(
    metadata(current),
    metadata(before),
    "Production environment binding changed",
  );
  const inherited = {},
    refs = [];
  for (const e of current) {
    if (Object.hasOwn(original, e.key)) continue;
    if (e.type === "sensitive") {
      refs.push({
        key: e.key,
        id: e.id,
        type: e.type,
        target: e.target,
        createdAt: e.createdAt,
        updatedAt: e.updatedAt,
      });
      continue;
    }
    const item = await api("/v1/projects/" + p.projectId + "/env/" + e.id);
    assert.equal(item.key, e.key);
    inherited[e.key] = item.value;
  }
  assert.equal(
    sha(JSON.stringify(refs)),
    "fc81fbdc28dff4114d25694a1d1b436715716ba28f70aac0ae907da7d6501b70",
  );
  assert.equal(
    sha(JSON.stringify({ ...inherited, ...original })),
    "0b618df5fb1f03847f044832ebe263ed3a8a89feb58c0c300a1f4c67f27132b0",
  );
  const flags = [
    "REGISTRATION_ENABLED",
    "COMPETITIONS_ENABLED",
    "PRIZES_ENABLED",
    "DOCKED_COMMERCIAL_SERVICE",
    "DOCKED_COMMERCIAL_SURFACES",
    "DOCKED_COMMERCIAL_CHECKOUT",
    "DOCKED_COMMERCIAL_MARKETPLACE",
    "DOCKED_PUBLIC_CUSTOMERS",
    "DOCKED_MEMBER_GOOGLE_TEST",
    "DOCKED_PUBLIC_PHONE_OTP",
    "DOCKED_ISOLATED_PHONE_TEST",
  ];
  for (const k of flags) assert.equal(runtime[k], "false", k);
  assert(
    !runtime.DOCKED_PACK_ACCEPTANCE ||
      runtime.DOCKED_PACK_ACCEPTANCE === "false",
  );
  return {
    inheritedSecretReferences: 5,
    unchangedProductionBindings: current.length,
    explicitRuntimeValues: 97,
    readableInheritedValues: 7,
    secretValuesIndependentlyReadBack: false,
    allLaunchGatesClosed: true,
  };
}
async function prerequisites(post = false) {
  authority();
  const files = verifyExport(),
    live = await inspect("docked.com.au");
  const expected = post
    ? json(docs + "/deployment-submitted.json").id
    : "dpl_A2BQuwB5YgRbfpcW4M7K9ihENqPy";
  assert.equal(live.id, expected);
  assert.equal(live.projectId, p.projectId);
  assert.equal(
    live.meta.githubCommitSha,
    post ? source : original.VERCEL_GIT_COMMIT_SHA,
  );
  const binding = await bindings();
  return { at: new Date().toISOString(), live: live.id, files, ...binding };
}
async function request(target, route, method = "GET", live = false) {
  const start = performance.now();
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
      elapsedMs: Math.round(performance.now() - start),
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
  const r = await promisify(execFile)(process.execPath, args, {
    cwd,
    env: { ...process.env, VERCEL_TOKEN: token },
    windowsHide: true,
    timeout: 55000,
    maxBuffer: 8e6,
  });
  return {
    status: Number(r.stdout.match(/DOCKED_STATUS:(\d+)/)?.[1]),
    body: r.stdout,
    headers: {},
    elapsedMs: Math.round(performance.now() - start),
  };
}
async function smoke(live = false) {
  const receipt = json(docs + "/deployment-submitted.json"),
    target = live ? "https://docked.com.au" : receipt.url,
    d = await inspect(new URL(target).hostname);
  assert.equal(d.id, receipt.id);
  assert.equal(d.readyState, "READY");
  assert.equal(d.target, "production");
  assert.equal(d.nodeVersion, "22.x");
  assert.equal(d.meta.githubCommitSha, source);
  assert.equal(d.projectId, p.projectId);
  assert.deepEqual(d.regions, ["syd1"]);
  assert.deepEqual(
    d.crons,
    json(priv + "/baseline-deployment.private.json").crons,
  );
  for (const k of Object.keys(runtime)) assert(d.env.includes(k), k);
  if (!live) {
    assert(!(d.alias ?? []).includes("docked.com.au"));
    const protectedResponse = await fetch(target + "/api/beta-release", {
      redirect: "manual",
      signal: AbortSignal.timeout(30000),
    });
    assert([401, 403, 302, 307].includes(protectedResponse.status),
      "Protected staging unexpectedly permits an unauthenticated request");
    await protectedResponse.body?.cancel();
  }
  const cases = [
    ["/api/beta-release", 200],
    ["/app/login", 200],
    ["/app/signup", 200],
    ["/app/invitation-setup", 200],
    ["/privacy", 200],
    ["/commercial-policy", 200],
    ["/refund-policy", 200],
    ["/api/store/google/commercial", 403],
    ["/api/workspace-wallet", 403],
    ["/api/mobile/capabilities", 401],
    ["/api/admin/incidents", 403],
    ["/api/admin/founder-credits", 403],
    ["/api/admin/incidents", 403, "POST"],
    ["/api/auth/phone", 403, "POST"],
    ...["nfl", "afl", "nrl", "basketball"].map((s) => [
      "/api/public-gameplay?sport=" + s,
      403,
    ]),
    ["/preview/pack-opening", 404],
  ];
  const checks = [];
  for (const [route, status, method = "GET"] of cases) {
    const r = await request(target, route, method, live);
    assert.equal(r.status, status, route);
    for (const [k, v] of Object.entries(runtime))
      if (
        /SECRET|PRIVATE_KEY|REFERENCE_KEY$|DATABASE_URL|BINDING_SECRET/.test(
          k,
        ) &&
        v.length > 16
      )
        assert(!r.body.includes(v), "Secret exposed");
    if (route === "/api/beta-release") {
      assert(r.body.includes(source));
      assert(r.body.includes('"publicRegistration":false'));
    }
    if (route === "/privacy")
      assert(r.body.includes(runtime.DOCKED_PUBLIC_PRIVACY_VERSION));
    checks.push({
      route,
      method,
      status: r.status,
      elapsedMs: r.elapsedMs,
      passed: true,
    });
  }
  const result = {
    at: new Date().toISOString(),
    source,
    packageSha,
    deployment: d.id,
    target: d.target,
    nodeVersion: d.nodeVersion,
    checks,
    anonymousSmoke: true,
    authenticatedReceiptRecovery: false,
    productionPerformanceMeasured: false,
  };
  save(
    docs +
      (live
        ? "/production-anonymous-smoke.json"
        : "/staging-anonymous-smoke.json"),
    result,
  );
  console.log(JSON.stringify({ ...result, checks: checks.length }));
}
async function main() {
  if (mode === "preflight") {
    const r = await prerequisites();
    save(docs + "/application-preflight.json", r);
    save(priv + "/runtime-deployment.private.json", runtime);
    console.log(JSON.stringify(r));
    return;
  }
  if (mode === "stage") {
    assert(
      !fs.existsSync(docs + "/deployment-submitted.json"),
      "Stage exists; inspect it",
    );
    const ready = await prerequisites();
    const db = json(docs + "/database-applied.json");
    assert(db.committed);
    assert.equal(db.source, source);
    assert(Date.now() - Date.parse(db.at) < 1800000);
    assert(Date.now() - Date.parse("2026-11-16T10:32:00Z") < 3600000);
    save(docs + "/stage-preflight.json", ready);
    const args = [
      "deploy",
      "--prod",
      "--skip-domain",
      "--yes",
      "--no-wait",
      "--meta",
      "dockedSourceCommit=" + source,
      "--meta",
      "githubCommitSha=" + source,
      "--meta",
      "githubCommitRef=" + p.branch,
    ];
    for (const k of Object.keys(runtime))
      args.push("--env", k, "--build-env", k);
    const result = await command(args, runtime);
    fs.writeFileSync(
      priv + "/deploy.private.log",
      result.stdout + "\n" + result.stderr,
    );
    const urls = [
      ...result.stdout.matchAll(
        /https:\/\/docked-production-[a-z0-9-]+\.vercel\.app/g,
      ),
    ].map((m) => m[0]);
    assert(urls.length);
    const url = urls.at(-1),
      d = await inspect(new URL(url).hostname);
    assert.equal(d.meta.githubCommitSha, source);
    assert.equal(d.projectId, p.projectId);
    assert.equal(
      (await inspect("docked.com.au")).id,
      "dpl_A2BQuwB5YgRbfpcW4M7K9ihENqPy",
    );
    const receipt = {
      at: new Date().toISOString(),
      source,
      packageSha,
      addendumSha,
      id: d.id,
      url,
      target: d.target,
      domainAssigned: false,
    };
    save(docs + "/deployment-submitted.json", receipt);
    console.log(JSON.stringify(receipt));
    return;
  }
  if (mode === "status") {
    const receipt = json(docs + "/deployment-submitted.json"),
      d = await inspect(receipt.id);
    console.log(
      JSON.stringify({
        id: d.id,
        readyState: d.readyState,
        nodeVersion: d.nodeVersion,
        target: d.target,
        source: d.meta.githubCommitSha,
        aliases: d.alias,
        errorCode: d.errorCode ?? null,
      }),
    );
    return;
  }
  if (mode === "smoke") {
    await prerequisites();
    await smoke();
    return;
  }
  if (mode === "promote") {
    await prerequisites();
    const smoke = json(docs + "/staging-anonymous-smoke.json"),
      auth = json(docs + "/staging-authenticated-acceptance.json"),
      db = json(docs + "/database-postflight.json");
    assert.equal(smoke.source, source);
    assert(smoke.checks.every((c) => c.passed));
    assert(
      auth.authenticatedAccess &&
        auth.existingReceiptRecovered &&
        auth.ownSession &&
        auth.purchases === 0,
    );
    assert.equal(auth.source, source);
    assert(Date.now() - Date.parse(auth.at) < 1800000);
    assert(Date.now() - Date.parse(db.at) < 600000);
    const receipt = json(docs + "/deployment-submitted.json"),
      d = await inspect(receipt.id);
    assert.equal(d.readyState, "READY");
    assert.equal(d.nodeVersion, "22.x");
    assert.equal(d.meta.githubCommitSha, source);
    await command(["promote", receipt.url, "--yes"]);
    assert.equal((await inspect("docked.com.au")).id, receipt.id);
    save(docs + "/deployment-promoted.json", {
      ...receipt,
      at: new Date().toISOString(),
      domainAssigned: true,
    });
    console.log(
      JSON.stringify({ promoted: true, source, deployment: receipt.id }),
    );
    return;
  }
  const r = await prerequisites(true);
  await smoke(true);
  save(docs + "/application-postflight.json", r);
}
main().catch((e) => {
  fs.writeFileSync(priv + "/application-stop.private.txt", String(e));
  console.error(
    "Application verification stopped; private diagnostic retained. No automatic promotion or retry.",
  );
  process.exitCode = 1;
});

// Read-only hosted acceptance. Does not authenticate as a member or open a pack.
import fs from "node:fs/promises";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
const evidence = "docs/qa/cinema-v3-release";
const staged = JSON.parse(await fs.readFile(evidence + "/staged.json", "utf8"));
const prepared = JSON.parse(
  await fs.readFile(evidence + "/prepared.json", "utf8"),
);
const live = process.argv.includes("--live");
const target = live ? "https://docked.com.au" : staged.url;
const cli =
  "C:/Users/61412/AppData/Local/npm-cache/_npx/67eb4586ca667318/node_modules/vercel/dist/index.js";
const authDirectory =
  "C:/Users/61412/Documents/ChatGPT/Docked.com.au/private-data/vercel-cli";
const privateDir = "private-data/cinema-v3-release/" + staged.commit;
await promisify(execFile)(
  process.execPath,
  [cli, "whoami", "--global-config", authDirectory],
  { windowsHide: true },
);
const auth = JSON.parse(
  await fs.readFile(authDirectory + "/auth.json", "utf8"),
);
const response = await fetch(
  "https://api.vercel.com/v13/deployments/" +
    new URL(target).hostname +
    "?teamId=" +
    prepared.team,
  { headers: { Authorization: "Bearer " + auth.token } },
);
assert(response.ok);
const deployment = await response.json();
assert.equal(deployment.id, staged.id);
assert.equal(deployment.readyState, "READY");
assert.equal(deployment.meta.githubCommitSha, staged.commit);
const runtime = JSON.parse(
  await fs.readFile(privateDir + "/runtime.private.json", "utf8"),
);
for (const flag of prepared.closedFlags) assert.equal(runtime[flag], "false");
const baseline = JSON.parse(
  await fs.readFile(privateDir + "/baseline.private.json", "utf8"),
);
assert.deepEqual(deployment.crons, baseline.crons);
const cases = [
  ["/api/beta-release", 200],
  ["/app/login", 200],
  ["/privacy", 200],
  ["/api/store/google/commercial", 403],
  ["/api/public-gameplay?sport=nfl", 403],
  ["/api/public-gameplay?sport=basketball", 403],
  ["/api/mobile/capabilities", 401],
  ["/api/workspace-wallet", 403],
  ["/profile/qa_billing", 503],
  ["/preview/pack-opening", 404],
  ["/account-deletion", 200],
];
const checks = [];
const bodies = new Map();
async function read(route) {
  if (live) {
    const r = await fetch(target + route, {
      redirect: "manual",
      signal: AbortSignal.timeout(45000),
    });
    return {
      status: r.status,
      body: await r.text(),
      headers: Object.fromEntries(r.headers),
    };
  }
  const { stdout } = await promisify(execFile)(
    process.execPath,
    [
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
    ],
    {
      cwd: privateDir + "/source",
      env: { ...process.env, VERCEL_TOKEN: auth.token },
      windowsHide: true,
      timeout: 55000,
      maxBuffer: 6e6,
    },
  );
  return {
    status: Number(stdout.match(/DOCKED_STATUS:(\d+)/)?.[1]),
    body: stdout,
    headers: {},
  };
}
let cursor = 0;
await Promise.all(
  Array.from({ length: 3 }, async () => {
    while (cursor < cases.length) {
      const [route, expected] = cases[cursor++];
      const result = await read(route);
      assert.equal(result.status, expected, route);
      if (route === "/api/beta-release") {
        assert(result.body.includes(staged.commit));
        assert(result.body.includes('"publicRegistration":false'));
      }
      if (route === "/app/login") assert(result.body.includes("Welcome back"));
      if (route === "/privacy") {
        assert(result.body.includes(runtime.DOCKED_PUBLIC_PRIVACY_VERSION));
        assert(result.body.includes("per-session identifier"));
      }
      if (route === "/profile/qa_billing")
        assert(result.body.includes("isolated test connection is closed"));
      bodies.set(route, result.body);
      checks.push({ route, status: result.status });
    }
  }),
);
// Verify the real release serves the new rarity-specific styling; no preview gate enabled.
const cssPaths = [
  ...new Set(
    [
      ...bodies
        .get("/app/login")
        .matchAll(/(?:href|src)="([^" ]+\.css(?:\?[^" ]*)?)"/g),
    ]
      .map((m) => m[1])
      .filter((p) => p.startsWith("/_next/")),
  ),
];
assert(cssPaths.length > 0);
const styles = (
  await Promise.all(
    cssPaths.map(async (route) => {
      const r = await read(route);
      assert.equal(r.status, 200);
      return r.body;
    }),
  )
).join("\n");
for (const tier of ["CORE", "RARE", "ELITE", "ULTRA_RARE", "LEGENDARY", "ICON"])
  assert(styles.includes(tier), tier + " hosted style");
assert(styles.includes("cinema-v2"));
const result = {
  at: new Date().toISOString(),
  target,
  deployment: deployment.id,
  commit: staged.commit,
  passed: true,
  checks: checks.sort((a, b) => a.route.localeCompare(b.route)),
  sixRarityStylesServed: true,
  closedFlags: prepared.closedFlags,
  cronConfigurationUnchanged: true,
  migrations: [],
  customerMutations: 0,
  authenticatedCustomerAcceptance: false,
  packOpened: false,
};
await fs.writeFile(
  evidence + (live ? "/live-verified.json" : "/candidate-verified.json"),
  JSON.stringify(result, null, 2),
);
console.log(JSON.stringify(result));

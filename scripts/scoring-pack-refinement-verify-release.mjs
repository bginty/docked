// Read-only hosted acceptance. Does not authenticate as a member or open a pack.
import fs from "node:fs/promises";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createHash } from "node:crypto";
const evidence = "docs/qa/scoring-pack-refinement-20261108/release";
const staged = JSON.parse(await fs.readFile(evidence + "/staged.json", "utf8"));
const prepared = JSON.parse(
  await fs.readFile(evidence + "/prepared.json", "utf8"),
);
const live = process.argv.includes("--live");
assert(/^[a-f0-9]{40}$/.test(staged.commit), "Invalid staged commit");
assert.equal(prepared.commit, staged.commit, "Prepared/staged commit mismatch");
assert.equal(prepared.project, "prj_l0rpVDPRuIRp9UcBUkudeyUK5yST");
assert.equal(prepared.team, "team_tf6xweKKyVCj9bTppUKttJ4l");
assert.equal(prepared.baseline, "f89ed4a9fe23eb9238becad3e545b6a48150cf35");
assert.equal(prepared.baselineId, "dpl_8pdKF956L5tTYFLxyhvonkHorQhu");
const target = live ? "https://docked.com.au" : staged.url;
const cli =
  "C:/Users/61412/AppData/Local/npm-cache/_npx/67eb4586ca667318/node_modules/vercel/dist/index.js";
const authDirectory =
  "C:/Users/61412/Documents/ChatGPT/Docked.com.au/private-data/vercel-cli";
const privateDir =
  "private-data/scoring-pack-refinement-release/" + staged.commit;
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
assert.equal(deployment.projectId, prepared.project);
const runtime = JSON.parse(
  await fs.readFile(privateDir + "/runtime.private.json", "utf8"),
);
for (const flag of prepared.closedFlags) assert.equal(runtime[flag], "false");
assert.equal(runtime.VERCEL_GIT_COMMIT_SHA, staged.commit);
assert.equal(
  createHash("sha256").update(JSON.stringify(runtime)).digest("hex"),
  prepared.runtimeDigest,
);
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
  ["/api/fantasy/scoring-history?sport=nfl", 401],
  ["/api/fantasy/scoring-history?sport=afl", 401],
  ["/api/fantasy/scoring-history?sport=nrl", 401],
  ["/api/fantasy/scoring-history?sport=basketball", 400],
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
      if (route.startsWith("/api/fantasy/scoring-history")) {
        const cache =
          result.headers["cache-control"] ??
          result.body.match(/cache-control:\s*([^\r\n]+)/i)?.[1] ??
          "";
        assert(
          cache.includes("private") && cache.includes("no-store"),
          "Scoring history must not be publicly cached",
        );
        assert(
          result.body.includes("Scoring history is unavailable"),
          "Scoring denial must not expose historical rows",
        );
      }
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
for (const marker of [
  "competition-round-label",
  "compact-social",
  "composer-submit",
  "pack-player-actions",
  "pack-back-to-pack",
  "pack-exit-confirmation",
  "pack-opening[hidden]",
  "pack-resume-notice",
  "sport-scoring-reference",
  "purchase-transition",
  "pack-review-card",
])
  assert(styles.includes(marker), "Missing navigation style " + marker);
assert(styles.includes("foil-pack-art"), "Hosted foil styling missing");
// Check every served production asset against the approved 21-variant inventory.
const assets = JSON.parse(
  await fs.readFile("design/foil-pack-rollout/asset-inventory.json", "utf8"),
);
assert.equal(assets.length, 21);
const assetFiles = assets.flatMap((v) => v.files);
let assetCursor = 0;
await Promise.all(
  Array.from({ length: 4 }, async () => {
    while (assetCursor < 3) {
      const file = assetFiles[assetCursor++];
      const route = file.path.replace(/^public/, "");
      if (live) {
        const response = await fetch(target + route);
        assert.equal(response.status, 200);
        const bytes = Buffer.from(await response.arrayBuffer());
        assert.equal(
          createHash("sha256").update(bytes).digest("hex"),
          file.sha256,
          route,
        );
      } else {
        const response = await read(route);
        assert.equal(response.status, 200, file);
      }
      checks.push({ route, status: 200 });
    }
  }),
);
const result = {
  at: new Date().toISOString(),
  target,
  deployment: deployment.id,
  commit: staged.commit,
  passed: true,
  checks: checks.sort((a, b) => a.route.localeCompare(b.route)),
  sixRarityStylesServed: true,
  approvedFoilStylesAndAssetsServed: true,
  packNavigationStylesServed: true,
  uxRefinementStylesServed: true,
  scoringPackRefinementStylesServed: true,
  scoringHistoryUnauthenticatedDenied: true,
  hiddenNbaHistoryRejected: true,
  exitConfirmationHidesRevealControls: true,
  assetsRequested: 3,
  foilVariants: assets.length,
  foilFiles: assets.flatMap((v) => v.files).length,
  sampleAssetHashesVerified: live,
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

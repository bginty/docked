import { cp, mkdir, symlink, access, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { resolve } from "node:path";
const evidence = process.argv.includes("--card-viewer")
  ? "docs/qa/card-viewer"
  : process.argv.includes("--admin-completion")
    ? "docs/qa/admin-completion"
    : process.argv.includes("--owner-reference")
      ? "docs/qa/owner-reference"
      : process.argv.includes("--prelaunch")
        ? "docs/qa/prelaunch"
        : process.argv.includes("--weekly-core")
          ? "docs/qa/weekly-core"
          : process.argv.includes("--futuristic")
            ? "docs/qa/futuristic-cards"
            : process.argv.includes("--pack-shopping")
              ? "docs/qa/pack-shopping"
              : process.argv.includes("--play-standings")
                ? "docs/qa/play-standings"
                : process.argv.includes("--market-overhaul")
                  ? "docs/qa/market-overhaul"
                  : process.argv.includes("--master-v2")
                    ? "docs/qa/master-v2"
                    : process.argv.includes("--private-preview")
                      ? "docs/qa/private-preview-release"
                      : process.argv.includes("--social-visual")
                        ? "docs/qa/social-visual-preview"
                        : process.argv.includes("--social-upgrade")
                          ? "docs/qa/social-upgrade"
                          : process.argv.includes("--jersey")
                            ? "docs/qa/jersey-refinement"
                            : process.argv.includes("--redemption")
                              ? "docs/qa/redemption"
                              : process.argv.includes("--reveal-stability")
                                ? "docs/qa/reveal-stability"
                                : process.argv.includes("--premium")
                                  ? "docs/qa/premium-v3"
                                  : process.argv.includes("--play-cards")
                                    ? "docs/qa/play-cards"
                                    : process.argv.includes("--rarity")
                                      ? "docs/qa/rarity-frames"
                                      : process.argv.includes("--visual")
                                        ? "docs/qa/mobile-cleanup"
                                        : "docs/qa/marketplace-release";
await mkdir(evidence, { recursive: true });
const root = process.cwd(),
  dir = resolve(
    process.argv.includes("--card-viewer")
      ? `tmp/card-viewer-build-${Date.now()}`
      : process.argv.includes("--admin-completion")
        ? "tmp/admin-completion-build"
        : process.argv.includes("--owner-reference")
          ? "tmp/owner-reference-build"
          : process.argv.includes("--prelaunch")
            ? "tmp/prelaunch-build"
            : process.argv.includes("--weekly-core")
              ? "tmp/weekly-core-build"
              : process.argv.includes("--futuristic")
                ? "tmp/futuristic-cards-build"
                : process.argv.includes("--pack-shopping")
                  ? "tmp/pack-shopping-build"
                  : process.argv.includes("--play-standings")
                    ? "tmp/play-standings-build"
                    : process.argv.includes("--market-overhaul")
                      ? "tmp/market-overhaul-build"
                      : "tmp/marketplace-release-build",
  );
await mkdir(dir, { recursive: true });
for (const p of [
  "src",
  "config",
  "public",
  "certs",
  "next.config.ts",
  "tsconfig.json",
  "package.json",
  "next-env.d.ts",
])
  await cp(resolve(root, p), resolve(dir, p), { recursive: true });
try {
  await access(resolve(dir, "node_modules"));
} catch {
  await symlink(
    resolve(root, "node_modules"),
    resolve(dir, "node_modules"),
    "junction",
  );
}
const env = Object.fromEntries(
  Object.entries(process.env).filter(([k]) =>
    /^(PATH|PATHEXT|SYSTEMROOT|WINDIR|COMSPEC|TEMP|TMP|USERPROFILE|APPDATA|LOCALAPPDATA|PROCESSOR_|NUMBER_OF_PROCESSORS)/i.test(
      k,
    ),
  ),
);
Object.assign(env, { NODE_ENV: "production", NEXT_TELEMETRY_DISABLED: "1" });
if (process.argv.includes("--card-viewer"))
  env.NODE_OPTIONS = "--max-old-space-size=2048";
for (const [key, label] of Object.entries({
  SUPABASE_SERVICE_ROLE_KEY: "SUPABASE",
  ODDS_API_KEY: "ODDS",
  ODDSPAPI_API_KEY: "ODDSPAPI",
  RESULTS_API_KEY: "RESULTS",
  SCANNER_API_KEY: "SCANNER",
  EMAIL_API_KEY: "EMAIL",
  DOCKED_REDEMPTION_BANK_KEY: "REDEMPTION",
}))
  env[key] = `DOCKED_BUILD_CANARY_${label}_20261002`;
async function run(args, path) {
  let log = "";
  const status = await new Promise((resolveStatus, reject) => {
    const child = spawn(process.execPath, args, {
      cwd: dir,
      env,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    child.stdout.on("data", (b) => (log += b));
    child.stderr.on("data", (b) => (log += b));
    child.on("error", reject);
    child.on("exit", resolveStatus);
  });
  await writeFile(path, log);
  if (status !== 0) throw Error("Local build check failed: " + path);
}
await run(
  [resolve(root, "node_modules/next/dist/bin/next"), "build"],
  evidence + "/build.txt",
);
await run(
  ["--import", "tsx", resolve(root, "scripts/check-client-boundary.ts")],
  evidence + "/client-boundary.txt",
);
console.log(
  "PASS: clean-environment production build and canary client-boundary scan",
);

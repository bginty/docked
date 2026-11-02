import { spawnSync } from "node:child_process";
const fields = {
  DOCKED_COMMERCIAL_REFERENCE_KEY: "REFERENCE",
  DOCKED_COMMERCIAL_ACCOUNT_BINDING_SECRET: "BINDING",
  DOCKED_GOOGLE_COMMERCIAL_PRIVATE_KEY: "GOOGLE",
  DOCKED_COMMERCIAL_DATABASE_URL: "DB",
  DOCKED_GOOGLE_COMMERCIAL_WORKER_SECRET: "WORKER",
  DOCKED_RETENTION_ARCHIVE_KEY: "RETENTION_KEY",
  DOCKED_RETENTION_DATABASE_URL: "RETENTION_DB",
  DOCKED_RETENTION_WORKER_SECRET: "RETENTION_WORKER",
};
const env = {
  ...process.env,
  DOCKED_COMMERCIAL_SERVICE: "false",
  DOCKED_COMMERCIAL_SURFACES: "false",
  DOCKED_COMMERCIAL_CHECKOUT: "false",
  DOCKED_RETENTION_SERVICE: "false",
  DOCKED_RETENTION_APPLY: "false",
  ...Object.fromEntries(
    Object.entries(fields).map(([name, marker]) => [
      name,
      `DOCKED_BUILD_CANARY_COMMERCIAL_${marker}_20261002`,
    ]),
  ),
};
for (const args of [
  ["node_modules/next/dist/bin/next", "build"],
  ["--import", "tsx", "scripts/check-client-boundary.ts"],
]) {
  const r = spawnSync(process.execPath, args, {
    env,
    stdio: "inherit",
    windowsHide: true,
  });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

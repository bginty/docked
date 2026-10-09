// Local verification only: never loads configured database/provider credentials.
import { readFileSync, existsSync } from "node:fs";
import { spawn } from "node:child_process";
const mode = process.argv[2];
if (!["build", "start", "browser"].includes(mode))
  throw Error("Expected build, start or browser");
const env = { ...process.env };
if (existsSync(".env.local"))
  for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const key = line.match(/^([A-Z0-9_]+)=/)?.[1];
    if (key) env[key] = "";
  }
Object.assign(env, {
  APP_ENV: "preview",
  SUPABASE_ENV: "preview",
  SITE_URL: "http://localhost:3000",
  REGISTRATION_ENABLED: "false",
  FANTASY_CARDS_PREVIEW: "false",
  DOCKED_BETA_STAGING: "false",
  DOCKED_HOSTED_REVIEW: "false",
  DOCKED_HOSTED_PRODUCTION: "false",
  SENDING_ENABLED: "false",
});
const args =
  mode === "build"
    ? ["node_modules/next/dist/bin/next", "build"]
    : mode === "start"
      ? ["scripts/start-preview.mjs"]
      : ["node_modules/@playwright/test/cli.js", "test"];
const child = spawn(process.execPath, args, {
  env,
  stdio: "inherit",
  windowsHide: true,
});
child.on("exit", (code) => (process.exitCode = code ?? 1));

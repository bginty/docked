/** Credential-free check of the actual staged origin. No forged Origin. */
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import {
  authority,
  packet,
  json,
  priv,
  docs,
  source,
  save,
} from "./lib/batch1-production-execution.mjs";
authority();
packet();
const stage = json(docs + "/deployment-submitted.json");
assert.equal(stage.source, source);
const cli =
  "C:/Users/61412/AppData/Local/npm-cache/_npx/67eb4586ca667318/node_modules/vercel/dist/index.js";
const token = json(
  "C:/Users/61412/Documents/ChatGPT/Docked.com.au/private-data/vercel-cli/auth.json",
).token;
const r = await promisify(execFile)(
  process.execPath,
  [
    cli,
    "curl",
    "/api/auth",
    "--deployment",
    stage.url,
    "--",
    "--silent",
    "--show-error",
    "--include",
    "--max-time",
    "45",
    "--request",
    "POST",
    "--header",
    "Origin: " + stage.url,
    "--header",
    "Content-Type: application/json",
    "--data",
    "{}",
    "--write-out",
    "\nDOCKED_STATUS:%{http_code}",
  ],
  {
    cwd: priv + "/source",
    env: { ...process.env, VERCEL_TOKEN: token },
    windowsHide: true,
    timeout: 55000,
    maxBuffer: 1e6,
  },
);
const status = Number(r.stdout.match(/DOCKED_STATUS:(\d+)/)?.[1]);
const blocked = status === 403 && r.stdout.includes('"Origin denied"');
save(docs + "/staging-origin-check.json", {
  at: new Date().toISOString(),
  source,
  deployment: stage.id,
  route: "/api/auth",
  actualOrigin: stage.url,
  status,
  originDenied: blocked,
  credentialsSubmitted: false,
  authAttempted: false,
  originForged: false,
  productionDomainChanged: false,
});
console.log(
  JSON.stringify({
    status,
    originDenied: blocked,
    credentialsSubmitted: false,
  }),
);

// Read-only candidate checks. Vercel access is distinct from member authentication.
import { readFile, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import assert from "node:assert/strict";
const directory = "docs/qa/public-launch-final/candidate";
const receipt = JSON.parse(await readFile(directory + "/deployment-submitted.json", "utf8"));
assert.match(receipt.commit, /^[a-f0-9]{40}$/);
assert.equal(receipt.projectId, "prj_l0rpVDPRuIRp9UcBUkudeyUK5yST");
assert.equal(receipt.domainAssigned, false);
const auth = JSON.parse(await readFile("C:/Users/61412/Documents/ChatGPT/Docked.com.au/private-data/vercel-cli/auth.json", "utf8"));
const cli = "C:/Users/61412/AppData/Local/npm-cache/_npx/67eb4586ca667318/node_modules/vercel/dist/index.js";
const checks = [];
for (const [url, expected] of [["/api/store/google/test", 403], ["/api/mobile/capabilities", 401], ["/api/nba-beta?view=state", 403]]) {
  const r = await promisify(execFile)(process.execPath,
    [cli, "curl", url, "--deployment", receipt.url, "--", "--silent", "--show-error", "--max-time", "40", "--write-out", "\nSTATUS:%{http_code}"],
    {cwd: `private-data/nba-production/${receipt.commit}/source`, env: {...process.env, VERCEL_TOKEN: auth.token}, windowsHide: true, timeout: 60000, maxBuffer: 1e6});
  const match = r.stdout.match(/\nSTATUS:(\d+)\s*$/);
  assert(match, "HTTP evidence missing");
  const status = Number(match[1]);
  assert.equal(status, expected, url + " must remain gated");
  let body;
  try { body = JSON.parse(r.stdout.slice(0, match.index)); }
  catch { throw Error("Expected application JSON, not a Vercel protection/build page"); }
  assert.equal(typeof body.error, "string");
  assert(!("accountBinding" in body) && !("products" in body));
  checks.push({url, status, passed: true});
}
const report = {at: new Date().toISOString(), commit: receipt.commit, checks, passed: true, memberAuthenticated: false, mutations: 0};
await writeFile(directory + "/store-gates.json", JSON.stringify(report, null, 2));
console.log(JSON.stringify(report));

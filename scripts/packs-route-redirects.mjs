// The reported bookmark must resolve on the actual deployment. Vercel access
// authenticates deployment protection only, not a Docked member account.
import { readFileSync, writeFileSync } from "node:fs";
import { promisify } from "node:util";
import { execFile } from "node:child_process";
import assert from "node:assert/strict";
const evidence = "docs/qa/packs-route/release",
  live = process.argv.includes("--live");
const receipt = JSON.parse(
  readFileSync(`${evidence}/deployment-submitted.json`, "utf8"),
);
const auth = JSON.parse(
  readFileSync(
    "C:/Users/61412/Documents/ChatGPT/Docked.com.au/private-data/vercel-cli/auth.json",
    "utf8",
  ),
);
const checks = [];
for (const sport of ["basketball", "afl", "nrl"]) {
  for (const tab of ["buy", "mine"]) {
    const path = `/fantasy/packs?sport=${sport}${tab === "mine" ? "&tab=mine" : ""}`;
    const expected = `/fantasy/test-wallet?view=packs&sport=${sport}${tab === "mine" ? "&packs=mine" : ""}`;
    let status, body, location;
    if (live) {
      const r = await fetch(`https://docked.com.au${path}`, {
        redirect: "manual",
        cache: "no-store",
        signal: AbortSignal.timeout(30000),
      });
      status = r.status;
      body = await r.text();
      location = r.headers.get("location");
    } else {
      const r = await promisify(execFile)(
        process.execPath,
        [
          "C:/Users/61412/AppData/Local/npm-cache/_npx/67eb4586ca667318/node_modules/vercel/dist/index.js",
          "curl",
          path,
          "--deployment",
          receipt.url,
          "--",
          "--silent",
          "--show-error",
          "--max-time",
          "40",
          "--include",
          "--write-out",
          "\nDOCKED_STATUS:%{http_code}",
        ],
        {
          cwd: `${process.cwd()}/private-data/nba-production/${receipt.commit}/source`,
          env: { ...process.env, VERCEL_TOKEN: auth.token },
          windowsHide: true,
          timeout: 60000,
          maxBuffer: 4e6,
        },
      );
      const match = r.stdout.match(/\nDOCKED_STATUS:(\d+)\s*$/);
      assert(match);
      status = Number(match[1]);
      body = r.stdout.slice(0, match.index);
      location = body.match(/^location:\s*(.+)\r?$/im)?.[1]?.trim();
    }
    assert([200, 307, 308].includes(status), `${path}: ${status}`);
    const redirectMarkup = body
      .replaceAll("&amp;", "&")
      .replaceAll("\\u0026", "&");
    // Next can stream a redirect after the layout starts rendering (HTTP 200).
    assert(
      location === expected ||
        redirectMarkup.includes(`NEXT_REDIRECT;replace;${expected};307;`),
      `Missing canonical redirect: ${path}`,
    );
    checks.push({ path, status, location: expected, passed: true });
  }
}
const result = {
  at: new Date().toISOString(),
  commit: receipt.commit,
  environment: live ? "live-domain" : "protected-production-candidate",
  authenticatedMemberTest: false,
  checks,
};
writeFileSync(
  `${evidence}/${live ? "live" : "candidate"}-redirects.json`,
  JSON.stringify(result, null, 2),
);
console.log(JSON.stringify(result));

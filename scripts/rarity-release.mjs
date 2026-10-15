// Existing admitted beta only. Read-only checks and explicitly authorised promotion.
// No database commands, member sessions, transactions, messages or DNS changes.
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { request } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { resolve, join } from "node:path";
const mode = process.argv[2];
assert.ok(["inspect", "candidate", "promote", "live"].includes(mode));
const root = "docs/qa/rarity-frames",
  privateRoot = "private-data/rarity-release";
mkdirSync(root, { recursive: true });
mkdirSync(privateRoot, { recursive: true });
const project = "prj_l0rpVDPRuIRp9UcBUkudeyUK5yST",
  team = "team_tf6xweKKyVCj9bTppUKttJ4l";
const auth = JSON.parse(readFileSync("private-data/vercel-cli/auth.json"));
const save = (name, value) =>
  writeFileSync(root + "/" + name + ".json", JSON.stringify(value, null, 2));
async function api(path, method = "GET", body) {
  const r = await fetch("https://api.vercel.com" + path + "?teamId=" + team, {
    method,
    headers: {
      Authorization: "Bearer " + auth.token,
      "Content-Type": "application/json",
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(30000),
    redirect: "error",
  });
  assert.ok(r.ok, "Vercel HTTP " + r.status);
  const text = await r.text();
  return text ? JSON.parse(text) : null;
}
const p = await api("/v9/projects/" + project);
assert.equal(p.accountId, team);
assert.equal(p.name, "docked-production");
assert.equal(p.link.repo, "docked");
assert.equal(p.link.org, "bginty");
assert.equal(p.ssoProtection.deploymentType, "all_except_custom_domains");
const aliases = [];
for (const name of ["docked.com.au", "www.docked.com.au"]) {
  const a = await api("/v4/aliases/" + name);
  assert.equal(a.projectId, project);
  aliases.push({ name, deployment: a.deployment?.id ?? a.deploymentId });
}
if (mode === "inspect") {
  save("rollback", { at: new Date().toISOString(), project, team, aliases });
  console.log(
    JSON.stringify({ project, team, aliases, protection: p.ssoProtection }),
  );
} else {
  const d = JSON.parse(
    readFileSync("docs/qa/friends-cutover/deployment-status.json"),
  );
  assert.equal(d.state, "READY");
  assert.equal(d.project, project);
  assert.equal(d.team, team);
  const actual = await api("/v13/deployments/" + d.id);
  assert.equal(actual.readyState, "READY");
  assert.equal(actual.projectId, project);
  assert.equal(actual.target, "production");
  assert.equal(actual.meta.githubCommitSha, d.commit);
  if (mode === "promote") {
    const check = JSON.parse(readFileSync(root + "/candidate.json"));
    const decision = JSON.parse(readFileSync(root + "/decision.json"));
    assert.equal(check.passed, true);
    assert.equal(check.deployment, d.id);
    assert.equal(decision.decision, "RELEASE");
    assert.equal(decision.commit, d.commit);
    assert.deepEqual(
      aliases,
      JSON.parse(readFileSync(root + "/rollback.json")).aliases,
      "Live deployment changed since review",
    );
    await api("/v10/projects/" + project + "/promote/" + d.id, "POST");
    console.log(
      JSON.stringify({
        promotionRequested: true,
        deployment: d.id,
        commit: d.commit,
      }),
    );
  } else {
    const base = mode === "live" ? "https://docked.com.au" : d.url;
    const client = await request.newContext();
    try {
      const get = async (path) => {
        if (mode === "live")
          return client.get(base + path, { maxRedirects: 0, timeout: 30000 });
        // Official CLI uses the owner's existing auth for the exact protected candidate.
        // Capture output privately; never expose auth headers or capability URLs.
        let output;
        try {
          output = execFileSync(
            process.execPath,
            [
              join(
                process.env.LOCALAPPDATA,
                "npm-cache/_npx/67eb4586ca667318/node_modules/vercel/dist/index.js",
              ),
              "curl",
              base + path,
              "--cwd",
              resolve("private-data/friends-deploy/" + d.commit + "/source"),
              "--global-config",
              resolve("private-data/vercel-cli"),
              "--scope",
              team,
              "--",
              "--silent",
              "--show-error",
              "--max-time",
              "30",
              "--write-out",
              "\\n%{http_code}",
            ],
            {
              encoding: "utf8",
              windowsHide: true,
              timeout: 90000,
              stdio: ["ignore", "pipe", "pipe"],
              maxBuffer: 10 * 1024 * 1024,
            },
          );
        } catch (e) {
          writeFileSync(
            privateRoot + "/curl-error.txt",
            String(e.stderr ?? "CLI request failed"),
            { mode: 0o600 },
          );
          throw Error(
            "Protected candidate CLI request failed; private diagnostic retained",
          );
        }
        const split = output.lastIndexOf("\n"),
          body = output.slice(0, split),
          code = Number(output.slice(split + 1));
        assert.ok(code >= 100 && code <= 599, "Expected CLI HTTP status");
        return {
          status: () => code,
          text: async () => body,
          json: async () => JSON.parse(body),
        };
      };
      const release = await get("/api/beta-release"),
        version = await release.json();
      assert.equal(release.status(), 200);
      assert.equal(version.commit, d.commit);
      assert.equal(version.deploymentId, d.id);
      assert.equal(version.projectRef, "pojoymtniryarxxunyvz");
      assert.equal(version.publicRegistration, false);
      assert.equal(version.invitedAuthentication, true);
      const checks = [
        "Exact source/deployment/database identity; invite-only admission",
      ];
      for (const path of [
        "/api/marketplace",
        "/api/marketplace?tab=activity",
        "/api/test-wallet",
        "/api/fantasy",
      ]) {
        assert.ok(
          [401, 403].includes((await get(path)).status()),
          "Anonymous denial: " + path,
        );
        checks.push("Anonymous denied: " + path);
      }
      const page = await get("/fantasy/cards");
      assert.ok([200, 307].includes(page.status()));
      const html = await page.text();
      const css = [...html.matchAll(/href="([^\"]+\.css[^\"]*)"/g)].map(
        (m) => m[1],
      );
      let styles = "";
      for (const path of css.filter((x) => x.startsWith("/_next/")))
        styles += await (await get(path.replaceAll("&amp;", "&"))).text();
      assert.ok(
        styles.includes("docked-single-reveal") &&
          styles.includes("pack-icon-celebration") &&
          styles.includes("rarity-frame"),
        "Current rarity/reveal CSS deployed",
      );
      checks.push(
        "Shared rarity frame, single reveal and Icon celebration styles present",
      );
      if (mode === "live")
        assert.ok(aliases.every((a) => a.deployment === d.id));
      save(mode, {
        at: new Date().toISOString(),
        passed: true,
        deployment: d.id,
        commit: d.commit,
        base,
        checks,
        hostedMemberMutations: 0,
        scope:
          "Anonymous read-only HTTP and deployed assets; local fixture transactions tested separately",
      });
      console.log(
        JSON.stringify({
          passed: true,
          deployment: d.id,
          commit: d.commit,
          checks: checks.length,
        }),
      );
    } finally {
      await client.dispose();
    }
  }
}

// Existing admitted beta only. Read-only checks and explicitly authorised promotion.
// No database commands, member sessions, transactions, messages or DNS changes.
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { request } from "@playwright/test";
const mode = process.argv[2];
assert.ok(["inspect", "access", "candidate", "promote", "live"].includes(mode));
const premium = process.argv[3] === "--premium";
const reveal = process.argv[3] === "--reveal-stability";
const jersey = process.argv[3] === "--jersey";
const walletPremium = process.argv[3] === "--wallet-premium" || jersey;
const playCards =
  process.argv[3] === "--play-cards" || premium || reveal || walletPremium;
const root = jersey ? "docs/qa/jersey-refinement/release" : walletPremium
    ? "docs/qa/private-beta-release"
    : reveal
      ? "docs/qa/reveal-stability"
      : premium
        ? "docs/qa/premium-v3"
        : playCards
          ? "docs/qa/play-cards"
          : "docs/qa/rarity-frames",
  privateRoot = jersey ? "private-data/jersey-release" : walletPremium
    ? "private-data/private-beta-release"
    : reveal
      ? "private-data/reveal-stability-release"
      : premium
        ? "private-data/premium-v3-release"
        : playCards
          ? "private-data/play-cards-release"
          : "private-data/rarity-release";
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
  if (mode === "access") {
    const access = await api(
      "/aliases/" + d.id + "/protection-bypass",
      "PATCH",
      { ttl: 3600 },
    );
    assert.equal(Object.keys(access.protectionBypass ?? {}).length, 1);
    writeFileSync(
      privateRoot + "/candidate-access.json",
      JSON.stringify(access),
      { mode: 0o600 },
    );
    console.log(
      JSON.stringify({
        deployment: d.id,
        privateCandidateAccess: true,
        ttlSeconds: 3600,
      }),
    );
  } else if (mode === "promote") {
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
      if (mode === "candidate") {
        // Existing deployment-scoped share capability; one hour, never logged.
        // CLI curl forwarding fails on this Windows CLI version. Protection stays on.
        const access = JSON.parse(
          readFileSync(privateRoot + "/candidate-access.json"),
        );
        const tokens = Object.keys(access.protectionBypass ?? {});
        assert.equal(tokens.length, 1);
        const url = new URL(base);
        url.searchParams.set("_vercel_share", tokens[0]);
        try {
          const initial = await client.get(url.href, { timeout: 30000 });
          assert.equal(new URL(initial.url()).origin, new URL(base).origin);
          assert.equal(initial.status(), 200);
        } catch {
          throw Error(
            "Candidate private access failed; capability omitted from diagnostics",
          );
        }
      }
      const get = (path) =>
        client.get(base + path, { maxRedirects: 0, timeout: 30000 });
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
      if (playCards) {
        assert.ok(
          styles.includes("lineup-workspace") &&
            styles.includes("collection-toolbar") &&
            styles.includes("workspace-wallet"),
          "Play/Cards redesign CSS deployed",
        );
        checks.push(
          "Play/Cards shared shell, field summary and collection toolbar styles present",
        );
      }
      if (walletPremium) {
        assert.ok(
          styles.includes("nfl-turf.svg") && styles.includes("player-jersey"),
          "Premium field and shared jersey styles deployed",
        );
        assert.ok(
          [401, 403].includes((await get("/api/redemptions")).status()),
          "Anonymous redemption history denied",
        );
        const denied = await client.post(base + "/api/redemptions", {
          data: {
            request: "00000000-0000-4000-8000-000000000000",
            operation: { action: "submit", credits: 100 },
          },
          headers: { origin: new URL(base).origin },
        });
        assert.ok(
          [400, 401, 403].includes(denied.status()),
          "Hosted redemption remains disabled",
        );
        const denial = await denied.json();
        assert.equal(denial.outcome, "rejected");
        if (denied.status() === 400)
          assert.equal(
            denial.error,
            "Redemption is disabled or this request is invalid.",
          );
        checks.push(
          "Premium turf/jerseys present; redemption history private and hosted mutations disabled",
        );
      }
      if (reveal) {
        assert.ok(
          styles.includes("pack-arrival.pack-turn") &&
            styles.includes("docked-reveal-seal") &&
            styles.includes("docked-reveal-light"),
          "Stable reveal handoff and simplified effects deployed",
        );
        checks.push(
          "Persistent reveal turn and simplified seal/light styles present",
        );
      }
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

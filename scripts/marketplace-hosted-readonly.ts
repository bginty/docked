// No business commands, member setup, admission changes or worker invocation.
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { ownerDatabase } from "./owner-gameplay-db.mjs";
import { marketplaceView, marketQuery } from "../src/core/marketplace";
import { refreshEconomyCatalogue } from "../src/server/economy-catalogue";
import { digest } from "../src/core/scoring-engine";
import type { Sql } from "postgres";
async function main() {
  const domain = process.argv.includes("--domain");
  const d = JSON.parse(
    readFileSync("docs/qa/friends-cutover/deployment-status.json", "utf8"),
  );
  assert.equal(d.state, "READY");
  const base = domain ? "https://docked.com.au" : d.url;
  const folder = "docs/qa/marketplace-release",
    priv = "private-data/marketplace-release/http";
  mkdirSync(priv, { recursive: true });
  const checks: string[] = [];
  async function get(path: string) {
    if (domain) {
      const r = await fetch(base + path, {
        redirect: "manual",
        signal: AbortSignal.timeout(30000),
      });
      return { status: r.status, body: await r.text(), headers: r.headers };
    }
    const response = resolve(priv, "response.txt"),
      headers = resolve(priv, "headers.txt");
    const r = spawnSync(
      process.execPath,
      [
        "C:/Users/61412/AppData/Local/npm-cache/_npx/67eb4586ca667318/node_modules/vercel/dist/index.js",
        "curl",
        path,
        "--deployment",
        base,
        "--global-config",
        resolve("private-data/vercel-cli"),
        "--scope",
        "team_tf6xweKKyVCj9bTppUKttJ4l",
        "--",
        "--silent",
        "--max-time",
        "30",
        "--output",
        response,
        "--dump-header",
        headers,
        "--write-out",
        "%{http_code}",
      ],
      { encoding: "utf8", timeout: 60000, windowsHide: true },
    );
    // CLI diagnostics may contain an authentication header: keep them private.
    writeFileSync(
      resolve(priv, "cli.txt"),
      String(r.stdout) + String(r.stderr),
      { mode: 0o600 },
    );
    assert.equal(
      r.status,
      0,
      "Authenticated Vercel read failed; private diagnostic retained",
    );
    const raw = readFileSync(headers, "utf8"),
      h = new Headers();
    for (const line of raw.split(/\r?\n/)) {
      const p = line.indexOf(":");
      if (p > 0) h.set(line.slice(0, p), line.slice(p + 1).trim());
    }
    return {
      status: Number(String(r.stdout).trim().slice(-3)),
      body: readFileSync(response, "utf8"),
      headers: h,
    };
  }
  const identity = await get("/api/beta-release");
  assert.equal(identity.status, 200);
  const version = JSON.parse(identity.body);
  assert.equal(version.commit, d.commit);
  assert.equal(version.deploymentId, d.id);
  assert.equal(version.projectRef, "pojoymtniryarxxunyvz");
  assert.equal(version.publicRegistration, false);
  checks.push(
    "Exact deployed commit/project/database and invitation-only release identity",
  );
  for (const path of [
    "/api/marketplace",
    "/api/marketplace?tab=activity",
    "/api/test-wallet",
    "/api/fantasy",
  ]) {
    const r = await get(path);
    assert.ok(
      [401, 403].includes(r.status),
      path + " must deny anonymous access",
    );
    assert.match(r.headers.get("cache-control") ?? "", /no-store/);
    assert.doesNotMatch(r.body, /BEGIN .*PRIVATE KEY|postgres(?:ql)?:\/\//);
  }
  checks.push(
    "Marketplace/activity/wallet/collection deny anonymous access with private no-store responses",
  );
  for (const path of ["/fantasy/market", "/fantasy/cards", "/fantasy/test-wallet"]) {
    const r = await get(path);
    assert.ok([200, 302, 303, 307, 308].includes(r.status), path);
    assert.notEqual(r.status, 404);
  }
  checks.push("Market, collection and wallet routes resolve; no obsolete 404");
  if (domain) {
    const r = await fetch("https://www.docked.com.au/app", {
      redirect: "manual",
    });
    assert.ok([301, 308].includes(r.status));
    assert.equal(r.headers.get("location"), base + "/app");
    checks.push("www retains HTTPS canonical redirect");
  }
  const db = ownerDatabase();
  try {
    const audit = await db.begin(
      "isolation level repeatable read read only",
      async (tx) => {
        const [row] =
          await tx`select document,revision from credits_sandbox.state where id`;
        const stateHash = digest(row.document),
          state = structuredClone(row.document);
      await refreshEconomyCatalogue(tx as unknown as Sql, state);
        const members =
          await tx`select user_id from credits_sandbox.access where enabled and beta_private.admitted(user_id)`;
        let projections = 0,
          expired = 0;
        for (const m of members) {
          const [r] =
            await tx`select credits_sandbox.market_context(${m.user_id}::uuid) context`;
          for (const tab of ["browse", "listings", "activity", "swaps"]) {
            const view = marketplaceView(
              state,
              m.user_id,
              r.context.labels,
              marketQuery.parse({ tab }),
              r.context,
            );
            for (const c of view.inventory)
              assert.equal(state.commerce.cards[c.id].owner, m.user_id);
            for (const l of view.rows)
              if (l.receipt)
                assert.ok(
                  [
                    state.listings[l.id].member,
                    state.listings[l.id].buyer,
                  ].includes(m.user_id),
                );
            for (const a of view.activity)
              if (a.kind === "cancellation") assert.equal(a.fee, undefined);
            projections++;
          }
          expired += (r.context.freeSwaps ?? []).filter(
            (s: { status: string }) => s.status === "expired",
          ).length;
        }
        assert.equal(
          digest(
            (await tx`select document from credits_sandbox.state where id`)[0]
              .document,
          ),
          stateHash,
        );
        const q = JSON.parse(
          readFileSync("private-data/customer-hosted-qa/identity.json", "utf8"),
        );
        const [qa] =
          await tx`select r.enabled roster_enabled,a.enabled wallet_enabled from beta_private.friends_roster r left join credits_sandbox.access a on a.user_id=r.user_id where r.user_id=${q.id}`;
        return {
          projections,
          expiredOfferProjections: expired,
          aggregateUnchanged: true,
          readOnly: true,
          qaAdmission: qa,
          scope:
            "Read-only compatibility/privacy projection audit, not an authenticated member HTTP journey or transaction",
        };
      },
    );
    checks.push(
      "Hosted SQL/read projections reconcile ownership, retained private receipts, cancellation amounts and expired offers without writes",
    );
    const report = {
      passed: true,
      at: new Date().toISOString(),
      deployment: d.id,
      commit: d.commit,
      base,
      checks,
      audit,
      hostedTransactions: false,
      hostedAuthenticatedSuccess: false,
      physicalDevice: false,
      limitation:
        "Dedicated hosted QA is revoked and remains so. Successful ordinary-member authenticated transactions verified locally only.",
    };
    writeFileSync(
      folder + (domain ? "/live.json" : "/candidate.json"),
      JSON.stringify(report, null, 2),
    );
    console.log(JSON.stringify(report));
  } finally {
    await db.end();
  }
}
main().catch((e) => {
  console.error({ error: e.message.split("\nCall log:")[0] });
  process.exitCode = 1;
});

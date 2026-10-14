// No business commands, member setup, admission changes or worker invocation.
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { request } from "@playwright/test";
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
  const folder = "docs/qa/marketplace-release";
  const access = await request.newContext();
  if (!domain) {
    const share = JSON.parse(
      readFileSync(
        "private-data/marketplace-release/candidate-access.json",
        "utf8",
      ),
    ).url;
    assert.equal(new URL(share).origin, base);
    await access.get(share);
  }
  const checks: string[] = [];
  async function get(path: string) {
    if (domain) {
      const r = await fetch(base + path, {
        redirect: "manual",
        signal: AbortSignal.timeout(30000),
      });
      return { status: r.status, body: await r.text(), headers: r.headers };
    }
    const r = await access.get(base + path, {
      maxRedirects: 0,
      timeout: 30000,
    });
    return {
      status: r.status(),
      body: await r.text(),
      headers: new Headers(r.headers()),
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
  for (const path of [
    "/fantasy/market",
    "/fantasy/cards",
    "/fantasy/test-wallet",
  ]) {
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
          await tx`select a.user_id from credits_sandbox.access a join beta_private.friends_roster r on r.user_id=a.user_id where a.enabled and r.enabled`;
        // admitted() takes FOR SHARE. Keep this audit strictly read-only: evaluate
        // the reviewed function's SELECT projection, not its locking admission gate.
        const [definition] =
          await tx`select pg_get_functiondef('credits_sandbox.market_context(uuid)'::regprocedure) body`;
        const expression = definition.body.match(
          /return (jsonb_build_object[\s\S]*?);\s*end/i,
        )?.[1];
        assert.ok(expression, "Unexpected reviewed context function");
        let projections = 0,
          expired = 0;
        for (const m of members) {
          const [r] = await tx.unsafe(
            `select ${expression} context from (select $1::uuid u) actor`,
            [m.user_id],
          );
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
    await access.dispose();
  }
}
main().catch((e) => {
  console.error({ error: e.message.split("\nCall log:")[0] });
  process.exitCode = 1;
});

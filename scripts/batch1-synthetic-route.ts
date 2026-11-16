/** Local prerequisite only: actual pack handlers/SQL, explicitly simulated Auth. */
import assert from "node:assert/strict";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";
import { build } from "esbuild";
import { syntheticDatabase } from "./lib/batch1-preview-local";
import {
  packAcceptanceDisabledFlags,
  packAcceptanceTarget,
} from "../src/core/pack-hosted-acceptance.mjs";
import { wallet } from "../src/core/credits-sandbox";
import {
  acceptanceDocs,
  acceptancePrivate,
  packOnly,
} from "./lib/batch1-acceptance-profile";
const fixture = JSON.parse(
  readFileSync(acceptancePrivate + "/fixtures.json", "utf8"),
);
const ref = packAcceptanceTarget.projectRef;
Object.assign(
  process.env,
  Object.fromEntries(packAcceptanceDisabledFlags.map((k) => [k, "false"])),
  {
    DOCKED_PACK_ACCEPTANCE: "true",
    DOCKED_SPORTS_TEST_COMMERCE: "true",
    DOCKED_SPORTS_PRIVATE_BETA: "true",
    DOCKED_PACK_ACCEPTANCE_FROM: new Date(Date.now() - 60000).toISOString(),
    DOCKED_PACK_ACCEPTANCE_UNTIL: new Date(Date.now() + 3600000).toISOString(),
    DOCKED_PACK_ACCEPTANCE_MEMBERS: fixture.accounts
      .map((a: any) => a.id)
      .join(","),
    VERCEL: "1",
    VERCEL_ENV: "preview",
    VERCEL_PROJECT_ID: packAcceptanceTarget.projectId,
    VERCEL_ORG_ID: packAcceptanceTarget.teamId,
    VERCEL_GIT_COMMIT_REF: packAcceptanceTarget.branch,
    VERCEL_GIT_COMMIT_SHA: "a".repeat(40),
    VERCEL_URL: "docked-preview-local-unit.vercel.app",
    SITE_URL: "https://docked-preview-local-unit.vercel.app",
    APP_ENV: "preview",
    SUPABASE_ENV: "preview",
    DOCKED_RELEASE_CHANNEL: "beta",
    DOCKED_BETA_STAGING: "true",
    BETA_ACCESS_ENABLED: "true",
    DOCKED_OWNER_GAMEPLAY: "true",
    DOCKED_TEST_MARKET_READ_ONLY: "true",
    DATABASE_RUNTIME: "serverless",
    DATABASE_CONNECTION_MODE: "session",
    NEXT_PUBLIC_SUPABASE_URL: `https://${ref}.supabase.co`,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_local-fixture-only",
    DATABASE_URL: `postgresql://docked_pack_acceptance.${ref}:NOT_A_CREDENTIAL@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres`,
  },
);
const slash = (p: string) => resolve(p).replaceAll("\\", "/");
const context = `import {AsyncLocalStorage} from 'node:async_hooks'; const scope=new AsyncLocalStorage(); export const run=(v,f)=>scope.run(v,f); export const ctx=()=>scope.getStore();`;
const db = `import {ctx} from 'synthetic-context'; import {betaSql} from '${slash("src/server/beta-sql.ts")}';import {packAcceptanceStatement} from '${slash("src/server/pack-acceptance-sql.ts")}';import {rateLimitQuery} from '${slash("src/server/rate-limit-query.ts")}'; export const db=()=>betaSql(ctx().sql,packAcceptanceStatement);export async function rateLimit(key,limit,seconds){const [r]=await db().unsafe(rateLimitQuery,[key,seconds]);return r.count<=limit;}`;
const auth = `import {ctx} from 'synthetic-context';export const requireIdentity=async()=>ctx().who;export const identity=requireIdentity;export const requireRole=async()=>{throw Error('Local fixture cannot escalate roles')};export const authClient=async()=>{throw Error('Real Auth is outside this explicitly local fixture')};export const sameOrigin=r=>r.headers.get('origin')==='http://127.0.0.1:3033';`;
const out = resolve("tmp/batch1/synthetic-route.cjs");
mkdirSync(resolve("tmp/batch1"), { recursive: true });
async function main() {
  assert(
    !(packOnly && process.argv.includes("--readers")),
    "Pack-only hosted profile excludes readers; retain existing local reader evidence",
  );
  await build({
    stdin: {
      contents:
        "export {POST,GET} from './src/app/api/test-wallet/route';export {ownedCollection} from './src/server/owned-collection';export {weeklyCore} from './src/server/weekly-core';export {run} from 'synthetic-context';",
      resolveDir: process.cwd(),
    },
    outfile: out,
    bundle: true,
    platform: "node",
    format: "cjs",
    packages: "external",
    plugins: [
      {
        name: "explicit-local-auth",
        setup(b) {
          b.onResolve({ filter: /^(synthetic-context|server-only)$/ }, (a) => ({
            path: a.path,
            namespace: "fixture",
          }));
          b.onLoad({ filter: /.*/, namespace: "fixture" }, (a) => ({
            contents: a.path === "synthetic-context" ? context : "",
            loader: "ts",
          }));
          b.onLoad(
            { filter: /[/\\]src[/\\]server[/\\](auth|db)\.ts$/ },
            (a) => ({
              contents: a.path.endsWith("auth.ts") ? auth : db,
              loader: "ts",
            }),
          );
          b.onLoad(
            {
              filter: /[/\\]src[/\\]app[/\\]api[/\\]test-wallet[/\\]route\.ts$/,
            },
            (a) => ({
              contents:
                "import {ctx} from 'synthetic-context';\n" +
                readFileSync(a.path, "utf8").replaceAll(
                  "} catch (error) {",
                  "} catch (error) { ctx().errors.push({message:error?.message,code:error?.code});",
                ),
              loader: "ts",
            }),
          );
        },
      },
    ],
  });
  const route = createRequire(resolve("package.json"))(out),
    sql = syntheticDatabase(true),
    operator = syntheticDatabase();
  const before =
    await operator`select revision,(select count(*)::int from jsonb_object_keys(document->'economy'->'instances')) cards from b1_credits_sandbox.state where id`;
  const results: any[] = [];
  try {
    if (process.argv.includes("--adversarial")) {
      const p = fixture.products.find(
          (p: any) =>
            p.sport === "nfl" && p.type === "STANDARD" && p.cards === 9,
        ),
        account = fixture.accounts[0];
      const who = {
          user: { id: account.id },
          aal: "aal2",
          sessionId: account.session,
        },
        errors: any[] = [];
      const request = randomUUID(),
        body = {
          request,
          command: {
            kind: "buy-pack",
            product: p.id,
            configuration: p.version,
            confirmed: true,
            policy: fixture.state.policy.version,
            expectedPrice: p.priceCredits,
          },
        };
      const send = async (value: unknown) => {
        const r = await route.run({ sql, who, errors }, () =>
          route.POST(
            new Request(
              "http://127.0.0.1:3033/api/test-wallet?result=receipt",
              {
                method: "POST",
                headers: {
                  origin: "http://127.0.0.1:3033",
                  "content-type": "application/json",
                },
                body: JSON.stringify(value),
              },
            ),
          ),
        );
        return { status: r.status, payload: await r.json() };
      };
      const [start] =
        await operator`select document from b1_credits_sandbox.state where id`;
      const raced = await Promise.all(
        Array.from({ length: 8 }, () => send(body)),
      );
      assert(
        raced.every((r) => r.status === 200),
        JSON.stringify(errors),
      );
      const [bought] =
        await operator`select document from b1_credits_sandbox.state where id`;
      assert.equal(
        bought.document.journal.length,
        start.document.journal.length + 1,
      );
      assert.equal(
        wallet(start.document, account.id).available -
          wallet(bought.document, account.id).available,
        p.priceCredits,
      );
      assert.equal(
        new Set(bought.document.economy.packs[request].cards).size,
        9,
      );
      for (const r of raced)
        assert.deepEqual(r.payload.packUpdate, raced[0].payload.packUpdate);
      const [rights] =
        await operator`select max(valid_until) until from b1_season_catalogue.rights`;
      const wait = Math.max(
        0,
        new Date(rights.until).getTime() - Date.now() + 500,
      );
      assert(
        wait <= 60000,
        "Use disconnected --short-rights rehearsal; immutable rights are never rewritten",
      );
      if (wait) await new Promise((r) => setTimeout(r, wait));
      let denied: number, opened: any;
      {
        const [pre] =
          await operator`select md5(document::text) hash from b1_credits_sandbox.state where id`;
        denied = (await send({ ...body, request: randomUUID() })).status;
        assert.notEqual(denied, 200);
        assert.equal(
          (
            await operator`select md5(document::text) hash from b1_credits_sandbox.state where id`
          )[0].hash,
          pre.hash,
        );
        const recovered = await send(body);
        assert.equal(recovered.status, 200);
        assert.deepEqual(
          recovered.payload.packUpdate,
          raced[0].payload.packUpdate,
        );
        opened = await send({
          request: randomUUID(),
          command: { kind: "open-pack", entitlement: request },
        });
        assert.equal(opened.status, 200);
        assert.equal(opened.payload.packUpdate.pack.receipt.cards.length, 9);
      }
      assert.equal(
        (
          await operator`select count(*)::int n from b1_beta_packs.issued where pack=${request}`
        )[0].n,
        9,
      );
      writeFileSync(
        acceptanceDocs + "/synthetic-adversarial-rehearsal.json",
        JSON.stringify(
          {
            at: new Date().toISOString(),
            localOnly: true,
            concurrentRequests: 8,
            oneDebit: true,
            nineUniqueCards: true,
            expiredRightsNewPurchaseDenied: true,
            deniedStateUnchanged: true,
            savedReceiptRecoveredAfterRightsExpiry: true,
            existingIssuedCardsOpenedAfterRightsExpiry: true,
          },
          null,
          2,
        ) + "\n",
      );
      console.log(
        "Concurrent duplicate, expired-rights denial and issued-card recovery checks passed locally",
      );
      return;
    }
    if (process.argv.includes("--readers")) {
      process.env.DOCKED_WEEKLY_CORE_ENABLED = "true";
      const checks = [];
      for (const account of fixture.accounts) {
        const who = {
            user: { id: account.id },
            aal: "aal2",
            sessionId: account.session,
          },
          errors: any[] = [];
        for (const sport of ["nfl", "afl", "nrl"]) {
          const collection = await route.run({ sql, who, errors }, () =>
            route.ownedCollection({ sport }),
          );
          assert.equal(collection.member, account.id);
          const pack = (
            await operator`select id from b1_sports_feed.weekly_core_packs where user_id=${account.id}::uuid and sport=${sport}`
          )[0];
          const command = { pack: pack.id, request: randomUUID(), sport };
          const opened = await route.run({ sql, who, errors }, () =>
            route.weeklyCore(command, sport),
          );
          assert.equal(
            new Set(opened.receipt.cards.map((c: any) => c.id)).size,
            4,
          );
          const replay = await route.run({ sql, who, errors }, () =>
            route.weeklyCore(command, sport),
          );
          assert.deepEqual(replay.receipt, opened.receipt);
          checks.push({
            sport,
            account: account.kind,
            collection: true,
            fourUniqueCoreCards: true,
            exactReplay: true,
          });
        }
      }
      writeFileSync(
        "docs/qa/batch1-hosted-20261116/synthetic-reader-rehearsal.json",
        JSON.stringify(
          {
            at: new Date().toISOString(),
            localOnly: true,
            productionContextUsed: false,
            checks,
          },
          null,
          2,
        ) + "\n",
      );
      console.log(
        JSON.stringify({ readerChecks: checks.length, localOnly: true }),
      );
      return;
    }
    for (const product of fixture.products.filter(
      (p: any) => process.argv.includes("--all-offers") || p.cards === 9,
    )) {
      const account = fixture.accounts[results.length % 2],
        errors: any[] = [],
        who = {
          user: { id: account.id },
          aal: "aal2",
          sessionId: account.session,
        };
      const request = randomUUID(),
        body = {
          request,
          command: {
            kind: "buy-pack",
            product: product.id,
            configuration: product.version,
            confirmed: true,
            policy: fixture.state.policy.version,
            expectedPrice: product.priceCredits,
          },
        };
      const req = (value = body) =>
        new Request(
          "http://127.0.0.1:3033/api/test-wallet?view=packs&result=receipt",
          {
            method: "POST",
            headers: {
              origin: "http://127.0.0.1:3033",
              "content-type": "application/json",
            },
            body: JSON.stringify(value),
          },
        );
      const [initial] =
        await operator`select document from b1_credits_sandbox.state where id`;
      const response = await route.run({ sql, who, errors }, () =>
        route.POST(req()),
      );
      const payload = await response.json();
      if (response.status !== 200) {
        console.log(
          JSON.stringify({
            sport: product.sport,
            type: product.type,
            status: response.status,
            error: payload,
            diagnostic: errors,
          }),
        );
        throw Error("Synthetic route rejected");
      }
      const retry = await route.run({ sql, who, errors }, () =>
        route.POST(req()),
      );
      assert.equal(retry.status, 200);
      const repeated = await retry.json();
      assert.deepEqual(repeated.packUpdate, payload.packUpdate);
      const [current] =
        await operator`select document from b1_credits_sandbox.state where id`;
      assert.equal(
        current.document.journal.length,
        initial.document.journal.length + 1,
      );
      assert.equal(
        wallet(current.document, account.id).available,
        wallet(initial.document, account.id).available - product.priceCredits,
      );
      assert.equal(
        new Set(current.document.economy.packs[request].cards).size,
        product.cards,
      );
      const opening = {
        request: randomUUID(),
        command: { kind: "open-pack", entitlement: request },
      } as any;
      const opened = await route.run({ sql, who, errors }, () =>
        route.POST(req(opening)),
      );
      assert.equal(opened.status, 200, JSON.stringify(errors));
      const receipt = await opened.json();
      assert.equal(receipt.packUpdate.pack.receipt.cards.length, product.cards);
      const [digest] =
        await operator`select md5(document::text) hash from b1_credits_sandbox.state where id`;
      const other = fixture.accounts.find((a: any) => a.id !== account.id);
      const denied = await route.run(
        {
          sql,
          who: {
            user: { id: other.id },
            aal: "aal2",
            sessionId: other.session,
          },
          errors,
        },
        () => route.POST(req({ ...opening, request: randomUUID() })),
      );
      assert.notEqual(
        denied.status,
        200,
        "Another account must not open this receipt",
      );
      assert.equal(
        (
          await operator`select md5(document::text) hash from b1_credits_sandbox.state where id`
        )[0].hash,
        digest.hash,
      );
      results.push({
        sport: product.sport,
        type: product.type,
        status: response.status,
        request,
        expectedCards: product.cards,
        oneDebit: true,
        savedReceipt: true,
        otherAccountDenied: true,
      });
    }
    const [after] =
      await operator`select revision,(select count(*)::int from jsonb_object_keys(document->'economy'->'instances')) cards,(select count(*)::int from b1_beta_packs.issued) allocations,(select sum(issued)::int from b1_commercial_billing.definitions) lifetime from b1_credits_sandbox.state where id`;
    assert.equal(
      after.cards - before[0].cards,
      results.reduce((sum, r) => sum + r.expectedCards, 0),
    );
    assert.equal(after.lifetime, after.allocations);
    writeFileSync(
      acceptanceDocs + "/synthetic-route-rehearsal.json",
      JSON.stringify(
        {
          at: new Date().toISOString(),
          localOnly: true,
          authentication: "explicitly simulated for disconnected prerequisite",
          actualHostedPerformance: false,
          results,
          after,
        },
        null,
        2,
      ) + "\n",
    );
    console.log(
      JSON.stringify({
        localRouteChecks: results.length,
        after,
        hostedPerformance: false,
      }),
    );
  } finally {
    await Promise.all([sql.end({ timeout: 3 }), operator.end({ timeout: 3 })]);
  }
}
main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});

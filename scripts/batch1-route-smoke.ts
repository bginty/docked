import assert from "node:assert/strict";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import {
  batch1Database,
  batch1Notices,
  batch1Plans,
} from "./lib/batch1-isolated-db";
import { batch1RouteFixture } from "./lib/batch1-route-fixture";
import { wallet } from "../src/core/credits-sandbox";

export function localEnvironment() {
  // Synthetic local values only; this profile is rejected by hosted deployment guards.
  Object.assign(process.env, {
    NODE_ENV: "development",
    APP_ENV: "production",
    SUPABASE_ENV: "production",
    SITE_URL: "http://127.0.0.1:3033",
    NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:55321",
    DATABASE_URL:
      "postgresql://docked_beta_app:isolated-not-a-credential@127.0.0.1:55322/postgres",
    DOCKED_LOCAL_MARKETPLACE_ACCEPTANCE: "true",
    DOCKED_BETA_STAGING: "true",
    DOCKED_FRIENDS_BETA: "true",
    DOCKED_OWNER_GAMEPLAY: "true",
    BETA_ACCESS_ENABLED: "true",
    DOCKED_NBA_PRIVATE_BETA: "true",
    DOCKED_SPORTS_PRIVATE_BETA: "true",
    DOCKED_SPORTS_TEST_COMMERCE: "true",
    DOCKED_TEST_MARKET_READ_ONLY: "true",
  });
  for (const key of [
    "REGISTRATION_ENABLED",
    "SENDING_ENABLED",
    "AUTH_EMAIL_ENABLED",
    "PAID_PLANS_ENABLED",
    "PRIZES_ENABLED",
    "COMPETITIONS_ENABLED",
    "ADS_ENABLED",
    "AFFILIATES_ENABLED",
    "DEALS_ENABLED",
    "DEMO_MODE",
  ])
    process.env[key] = "false";
}
export const restoreProfiles: unknown[] = [];
export function nestedSql(tx: any) {
  return new Proxy(tx, {
    apply(target, thisArg, args: any[]) {
      const strings = args[0];
      if (
        process.argv.includes("--profile") &&
        Array.isArray(strings) &&
        (String(strings[0]).startsWith("update credits_sandbox.state set") ||
          (String(strings[0]).trim() === "update" &&
            String(strings[1]).startsWith(".state set")))
      ) {
        const altered = [...strings];
        altered[0] = "explain(analyze,format json) " + altered[0];
        Object.defineProperty(altered, "raw", { value: [...altered] });
        return (
          Reflect.apply(target, thisArg, [
            altered,
            ...args.slice(1),
          ]) as Promise<any[]>
        ).then((rows: any[]) => {
          const plan = rows[0]["QUERY PLAN"][0];
          restoreProfiles.push({
            executionMs: plan["Execution Time"],
            triggers: plan.Triggers,
          });
          return [];
        });
      }
      return Reflect.apply(target, thisArg, args);
    },
    get(target, key) {
      if (key === "begin")
        return (...args: any[]) =>
          tx.savepoint((child: any) => args.at(-1)(nestedSql(child)));
      const value = Reflect.get(target, key);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
}
async function main() {
  localEnvironment();
  const module = await batch1RouteFixture();
  const sql = batch1Database("postgres");
  const rollback = new Error("expected isolated rollback");
  try {
    await sql
      .begin(async (tx) => {
        if (process.argv.includes("--generic"))
          await tx`set local plan_cache_mode=force_generic_plan`;
        if (process.argv.includes("--nested-plans"))
          await tx.unsafe(
            `load 'auto_explain';set local auto_explain.log_min_duration='100ms';set local auto_explain.log_nested_statements=on;set local auto_explain.log_analyze=on;set local auto_explain.log_format='json';set local auto_explain.log_level='notice';set local auto_explain.log_parameter_max_length=0;`,
          );
        for (const name of process.argv.includes("--pending-only")
          ? ["20261115113306_batch_private_pack_issuance_validation.sql"]
          : [
              "20261115113306_batch_private_pack_issuance_validation.sql",
              "20261115211545_batch1_pack_guard_batching.sql",
              "20261115235000_batch1_persistence_subdocuments.sql",
            ])
          await tx.unsafe(readFileSync(`supabase/migrations/${name}`, "utf8"));
        const [identity] =
          await tx`select a.user_id,(select s.id from auth.sessions s where s.user_id=a.user_id and s.aal='aal2' order by updated_at desc limit 1) session_id from credits_sandbox.access a where a.kind='owner' and a.enabled`;
        const who = {
          user: { id: String(identity.user_id) },
          aal: "aal2",
          sessionId: identity.session_id,
        };
        const [{ document: state }] =
          await tx`select document from credits_sandbox.state where id`;
        const product = Object.values(
          state.economy.products as Record<string, any>,
        ).find(
          (p) =>
            p.sport === "afl" &&
            p.type === "STANDARD" &&
            p.cards === 9 &&
            p.cataloguePolicy === "founder-credit-season-v1",
        )!;
        const balance = wallet(state, who.user.id).available;
        const id = randomUUID();
        await tx`set local role docked_beta_app`;
        const body = {
          request: id,
          command: {
            kind: "buy-pack",
            product: product.id,
            configuration: product.version,
            confirmed: true,
            policy: state.policy.version,
            expectedPrice: product.priceCredits,
          },
        };
        const results: unknown[] = [];
        for (const command of [
          body,
          body,
          {
            request: randomUUID(),
            command: { kind: "open-pack", entitlement: id },
          },
        ]) {
          const start = performance.now();
          const errors: unknown[] = [];
          const response = await module.run(
            { sql: nestedSql(tx), who, errors },
            () =>
              module.POST(
                new Request(
                  "http://127.0.0.1:3033/api/test-wallet?view=packs&result=receipt",
                  {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json",
                      Origin: "http://127.0.0.1:3033",
                    },
                    body: JSON.stringify(command),
                  },
                ),
              ),
          );
          const text = await response.text();
          const result = JSON.parse(text);
          if (response.status !== 200)
            throw Error(`Route rejected: ${JSON.stringify(errors)}`);
          assert.equal(result.packUpdate.pack.cardCount, 9);
          assert.equal(
            result.packUpdate.wallet.available,
            balance - product.priceCredits,
          );
          results.push({
            action: command.command.kind,
            durationMs: Math.round(performance.now() - start),
            bytes: Buffer.byteLength(text),
            timings: response.headers.get("Server-Timing"),
            cards: result.packUpdate.pack.cardCount,
          });
        }

        const directory = "docs/qa/batch1-pack-phone-20261116";
        mkdirSync(directory, { recursive: true });
        const evidence = {
          at: new Date().toISOString(),
          scope:
            "Actual API route over isolated restored PostgreSQL; simulated Auth; rollback only",
          results,
          profiles: restoreProfiles,
        };
        writeFileSync(
          directory + "/route-smoke.json",
          JSON.stringify(evidence, null, 2) + "\n",
        );
        if (batch1Plans.length)
          writeFileSync(
            directory + "/nested-plans.json",
            JSON.stringify(batch1Plans, null, 2),
          );
        console.log(JSON.stringify({ ...evidence, steps: batch1Notices }));
        throw rollback;
      })
      .catch((error) => {
        if (error !== rollback) throw error;
      });
  } finally {
    await sql.end({ timeout: 5 });
  }
}
if (process.argv[1]?.endsWith("batch1-route-smoke.ts"))
  void main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });

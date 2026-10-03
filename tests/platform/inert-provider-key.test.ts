import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import path from "node:path";
import { build } from "esbuild";
import manifest from "../../config/hosted-preview.json";
import {
  assertHostedPreview,
  hostedPreviewDisabledFlags,
} from "../../src/core/hosted-preview";
import { marketDataEnvironment } from "../../src/core/market-data-environment";
import { providerReadiness } from "../../src/core/data-health";

// Fictional credentials; no actual provider, Auth or database request is allowed.
function environment(): Record<string, string | undefined> {
  const database = new URL(
    "postgres://aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres",
  );
  database.username = `postgres.${manifest.supabaseProjectRef}`;
  database.password = "fictional-test-only";
  return {
    DOCKED_HOSTED_PREVIEW: "true",
    APP_ENV: "preview",
    SUPABASE_ENV: "preview",
    VERCEL_ENV: "preview",
    VERCEL_PROJECT_ID: manifest.projectId,
    SITE_URL: manifest.origin,
    NEXT_PUBLIC_SUPABASE_URL: `https://${manifest.supabaseProjectRef}.supabase.co`,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_fictional_test_only",
    DATABASE_URL: database.href,
    DATABASE_CONNECTION_MODE: "session",
    MARKET_DATA_POLLING_ENABLED: "false",
    THE_ODDS_API_KEY: "fictional-provider-key-only",
    ...Object.fromEntries(
      hostedPreviewDisabledFlags.map((key) => [key, "false"]),
    ),
  };
}

test("modern key storage is explicit and cannot turn Preview into provider readiness", () => {
  const env = environment();
  assert.doesNotThrow(() => assertHostedPreview(env));
  assert.equal(marketDataEnvironment(env), false);
  assert.equal(providerReadiness(env, "odds"), "PENDING_RIGHTS");
  assert.doesNotThrow(() =>
    assertHostedPreview({
      ...env,
      THE_ODDS_API_KEY: undefined,
      ODDSPAPI_API_KEY: "fictional-provider-key-only",
    }),
  );
  for (const change of [
    { MARKET_DATA_POLLING_ENABLED: undefined },
    { MARKET_DATA_POLLING_ENABLED: "" },
    { MARKET_DATA_POLLING_ENABLED: "FALSE" },
    { MARKET_DATA_POLLING_ENABLED: "true" },
    { MARKET_DATA_PROVIDER: "unreviewed" },
    { MARKET_DATA_PROJECT_REF: "unrelated" },
    { VERCEL_PROJECT_ID: "prj_unrelated" },
    { VERCEL_ENV: "production" },
    { APP_ENV: "production" },
    { SUPABASE_ENV: "production" },
    { SITE_URL: "https://docked.com.au" },
    { SITE_URL: "https://other-preview.example.invalid" },
    { NEXT_PUBLIC_SUPABASE_URL: "https://unrelated.supabase.co" },
    {
      DATABASE_URL: env.DATABASE_URL!.replace(
        manifest.supabaseProjectRef,
        "unrelated",
      ),
    },
    { ODDS_API_KEY: "fictional-provider-key-only" },
    { ODDS_RIGHTS_REFERENCE: "unreviewed" },
    { RESULTS_API_KEY: "fictional-provider-key-only" },
    ...hostedPreviewDisabledFlags.map((key) => ({ [key]: "true" })),
  ])
    assert.throws(() => assertHostedPreview({ ...env, ...change }));
});

test("the actual importer and readiness reader never reach DB or fetch with an inert stored key", async (t) => {
  let dbCalls = 0;
  const dbTrap = () => {
    dbCalls++;
    throw new Error("Inert provider mode must not reach the database");
  };
  const fetch = t.mock.method(globalThis, "fetch", async () => {
    throw new Error("Inert provider mode must not make a network request");
  });
  const built = await build({
    absWorkingDir: process.cwd(),
    entryPoints: [path.resolve("src/server/market-data.ts")],
    bundle: true,
    write: false,
    platform: "node",
    format: "cjs",
    packages: "external",
    plugins: [
      {
        name: "inert-importer-boundary",
        setup(b) {
          b.onResolve({ filter: /.*/ }, (args) => {
            if (
              args.path === "server-only" ||
              (args.importer === path.resolve("src/server/market-data.ts") &&
                /^(\.\/db|\.\/queries|\.\/market-reference|\.\/community-edges)$/.test(
                  args.path,
                ))
            )
              return { path: args.path, namespace: "isolated-boundary" };
            if (args.path.startsWith("node:"))
              return { path: args.path, external: true };
            if (
              !args.path.startsWith("@/") &&
              !args.path.startsWith(".") &&
              !path.isAbsolute(args.path)
            )
              return { path: args.path, external: true };
            const target = args.path.startsWith("@/")
              ? path.resolve("src", args.path.slice(2))
              : path.isAbsolute(args.path)
                ? args.path
                : path.resolve(path.dirname(args.importer), args.path);
            const file = [
              target,
              `${target}.ts`,
              `${target}.js`,
              `${target}.json`,
            ].find(existsSync);
            if (!file)
              throw new Error("Unresolved isolated importer dependency");
            return { path: file, namespace: "actual-importer" };
          });
          b.onLoad({ filter: /.*/, namespace: "actual-importer" }, (args) => ({
            contents: readFileSync(args.path, "utf8"),
            loader: args.path.endsWith(".json")
              ? "json"
              : args.path.endsWith(".ts")
                ? "ts"
                : "js",
          }));
          b.onLoad(
            { filter: /.*/, namespace: "isolated-boundary" },
            ({ path: name }) => ({
              contents:
                name === "server-only"
                  ? ""
                  : name === "./db"
                    ? "export function db() { return __dbTrap(); }"
                    : name === "./queries"
                      ? "export function regionAccess() { throw Error('Unexpected regional query'); }"
                      : name === "./market-reference"
                        ? "export function loadMarketReference() { throw Error('Unexpected reference query'); }"
                        : "export function registerCommunityQuoteEvidence() { throw Error('Unexpected evidence write'); }",
              loader: "js",
            }),
          );
        },
      },
    ],
  });
  const module = {
    exports: {} as {
      ingestCurrentMarketData(): Promise<unknown>;
      marketDataReadiness(): Promise<{ status: string }>;
    },
  };
  runInNewContext(built.outputFiles[0].text, {
    require: createRequire(path.resolve("package.json")),
    module,
    exports: module.exports,
    __dbTrap: dbTrap,
    process,
    fetch: (...args: Parameters<typeof globalThis.fetch>) =>
      globalThis.fetch(...args),
    Buffer,
    URL,
    AbortSignal,
    setTimeout,
    clearTimeout,
  });
  const previous = process.env;
  try {
    // Replace the test process's environment, so no configured local credential is consulted.
    process.env = {
      NODE_ENV: "test",
      ...Object.fromEntries(
        Object.entries(environment()).filter(
          (entry): entry is [string, string] => entry[1] !== undefined,
        ),
      ),
    };
    assertHostedPreview(process.env);
    await assert.rejects(
      module.exports.ingestCurrentMarketData(),
      /Market data preview authority is disabled/,
    );
    assert.equal(
      (await module.exports.marketDataReadiness()).status,
      "NOT_CONFIGURED",
    );
    process.env.MARKET_DATA_PROVIDER = "the-odds-api";
    assert.equal(
      (await module.exports.marketDataReadiness()).status,
      "DISABLED",
    );
    await assert.rejects(
      module.exports.ingestCurrentMarketData(),
      /Market data preview authority is disabled/,
    );
    process.env.MARKET_DATA_PROVIDER = "odds-papi";
    process.env.ODDSPAPI_API_KEY = "fictional-provider-key-only";
    assert.equal(
      (await module.exports.marketDataReadiness()).status,
      "DISABLED",
    );
    await assert.rejects(
      module.exports.ingestCurrentMarketData(),
      /Market data preview authority is disabled/,
    );
    assert.equal(dbCalls, 0);
    assert.equal(fetch.mock.callCount(), 0);
  } finally {
    process.env = previous;
  }
});

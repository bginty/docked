import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import path from "node:path";
import { build } from "esbuild";
import { hash, strategyV1, type Rules } from "../../src/core/pricing";
import { validateFootballEdgeStrategy } from "../../src/core/football-edge";
import { marketReferenceV1 } from "../../src/core/market-reference";
import { referenceSources } from "./market-reference-fixtures";
import type { ReferenceSql } from "../../src/server/market-reference";

// These are authored contract fixtures. Real server orchestration is bundled;
// database/network boundaries are replaced, never real provider/account data.
const commit = "a".repeat(40),
  at = "2026-10-04T01:00:02Z",
  start = "2026-10-04T07:00:00Z";
const jobId = "00000000-0000-4000-8000-000000000001",
  lease = "00000000-0000-4000-8000-000000000002";
const rules: Rules = {
  eventId: "fictional-event",
  competition: "soccer_epl",
  participants: ["Fictional Home", "Fictional Away"],
  market: "football_1x2",
  period: "full_game",
  overtime: false,
  draw: true,
  line: null,
  settlement: "regulation_90_plus_stoppage",
  outcomes: ["Fictional Home", "Draw", "Fictional Away"],
};
const cfg = validateFootballEdgeStrategy({
  ...strategyV1,
  version: "football-independent-edge-v1.0.0-fixture",
  method: "football-independent-model",
  aggregation: "independent-sport-model-v1",
  selectionRule: "EV-desc-selection-ascending",
  modelVersion: "football-goals-v1.0.0-fixture",
  maxSportDataAgeSeconds: 86400,
  maxEdgesPerEvent: 1,
  stakeUnits: "1.00",
  minEV: "0.05",
  competitions: ["soccer_epl"],
  marketReference: {
    ...marketReferenceV1,
    pricingBookmakers: [],
    availabilityBookmakers: ["market-a", "market-b"],
  },
});
const recordInput = {
  modelVersion: cfg.modelVersion,
  eventId: rules.eventId,
  windowSeconds: 21600,
  jobId,
  leaseToken: lease,
  idempotencyKey: "fixture-prediction",
};
const comparisonInput = {
  marketId: "fictional-market",
  strategyId: cfg.version,
  regionPolicyId: "00000000-0000-4000-8000-000000000003",
  purpose: "research" as const,
  predictionId: "fictional-prediction",
};
let bundle: Promise<string> | undefined;
function source() {
  return (bundle ??= build({
    absWorkingDir: process.cwd(),
    stdin: {
      contents:
        "export * from './src/server/football-scanner'; export {recordFootballPrediction} from './src/server/model-ledger'; export {scannerOperation} from './src/server/edge-scanner';",
      resolveDir: process.cwd(),
      loader: "ts",
    },
    bundle: true,
    write: false,
    platform: "node",
    format: "cjs",
    packages: "external",
    plugins: [
      {
        name: "football-runtime-boundaries",
        setup(b) {
          const stubs: Record<string, string> = {
            db: "export const db=()=>__sql;export const rateLimit=async()=>true;",
            auth: "export const requireRole=async()=>({user:{id:'00000000-0000-4000-8000-000000000004'},sessionId:'fixture-session',aal:'aal2'});",
            config:
              "export const config=()=>({database:true,paper:false,publication:false});",
            queries: "export const regionAccess=async()=>({allowed:false});",
            "market-reference":
              "export const loadMarketReference=(...args)=>__load(...args);export const retainMarketReference=(...args)=>__retain(...args);",
            queue: "export const finishJob=async()=>{};",
            "market-data": "export const purgeExpiredMarketData=async()=>0;",
            "provider-trial":
              "export const providerTrialDataOnly=async()=>true;",
          };
          b.onResolve({ filter: /.*/ }, (args) => {
            if (args.path === "server-only")
              return { path: "empty", namespace: "stub" };
            if (
              args.path.startsWith("node:") ||
              (!args.path.startsWith("@/") &&
                !args.path.startsWith(".") &&
                !path.isAbsolute(args.path))
            )
              return { path: args.path, external: true };
            const target = args.path.startsWith("@/")
              ? path.resolve("src", args.path.slice(2))
              : path.resolve(
                  args.resolveDir || path.dirname(args.importer),
                  args.path,
                );
            for (const name of Object.keys(stubs))
              if (target === path.resolve("src/server", name))
                return { path: name, namespace: "stub" };
            const file = [
              target,
              `${target}.ts`,
              `${target}.js`,
              `${target}.json`,
            ].find(existsSync);
            if (!file) throw Error("Unresolved isolated scanner dependency");
            return { path: file, namespace: "actual" };
          });
          b.onLoad({ filter: /.*/, namespace: "stub" }, (args) => ({
            contents: stubs[args.path] ?? "",
            loader: "js",
          }));
          b.onLoad({ filter: /.*/, namespace: "actual" }, (args) => ({
            contents: readFileSync(args.path, "utf8"),
            loader: args.path.endsWith(".json") ? "json" : "ts",
            resolveDir: path.dirname(args.path),
          }));
        },
      },
    ],
  }).then((r) => r.outputFiles[0].text));
}
function readyRow() {
  return {
    id: "fictional-prediction",
    status: "READY",
    event_id: rules.eventId,
    model_version: cfg.modelVersion,
    requested_model_version: cfg.modelVersion,
    window_seconds: 21600,
    code_commit: commit,
    config_hash: "b".repeat(64),
    input_hash: "c".repeat(64),
    as_of_time: new Date("2026-10-04T01:00:00Z"),
    calculated_at: new Date("2026-10-04T01:00:00Z"),
    created_at: new Date("2026-10-04T01:00:01Z"),
    input_cutoff: new Date("2026-10-04T00:00:00Z"),
    start_at: new Date(start),
    event_start_at: new Date(start),
    participants: rules.participants,
    event_participants: rules.participants,
    probabilities: { home: "0.58", draw: "0", away: "0.42" },
  };
}
async function runtime(initial?: ReturnType<typeof readyRow>) {
  const calls: string[] = [],
    rows: Record<string, any>[] = initial ? [initial] : [];
  let pending: Record<string, any> | null = null,
    throwMarket = false,
    inside = false,
    network = 0;
  const sql = Object.assign(
    async (strings: TemplateStringsArray, ...values: unknown[]) => {
      const q = strings.join("?");
      calls.push(q);
      if (
        q.includes("set_config(") ||
        q.includes("scanner_assert_worker") ||
        q.includes("pg_advisory_xact_lock") ||
        q.includes("assert_football_prediction")
      )
        return [];
      if (
        q.includes(
          "select * from private.football_model_attempts where idempotency_key",
        )
      )
        return rows;
      if (q.includes("insert into private.football_model_attempts")) {
        assert.ok(inside);
        pending = {
          id: "fictional-prediction",
          status: "NOT_CONFIGURED",
          event_id: values[2],
          requested_model_version: values[3],
          window_seconds: values[4],
          reason: "MODEL_PROBABILITY_UNAVAILABLE",
        };
        calls.push("prediction-written-uncommitted");
        return [pending];
      }
      if (
        q.includes("from private.football_model_attempts p join private.events")
      )
        return rows;
      if (q.includes("from private.strategy_versions"))
        return [
          {
            config: cfg,
            config_hash: hash(cfg),
            code_commit: commit,
            allowed: true,
          },
        ];
      if (q.includes("from private.region_policies"))
        return [{ features: ["market_data"] }];
      if (q.includes("select rules,event_id from private.markets"))
        return [{ rules, event_id: rules.eventId }];
      if (
        q.includes("from private.events e cross join jsonb_array_elements_text")
      )
        return rows.length
          ? []
          : [{ id: rules.eventId, window_seconds: 21600 }];
      throw Error(`Unexpected offline query: ${q}`);
    },
    {
      json: (v: unknown) => v,
      begin: async (action: (tx: ReferenceSql) => Promise<unknown>) => {
        assert.equal(inside, false, "No nested pool acquisition");
        inside = true;
        calls.push("begin");
        try {
          const r = await action(sql as unknown as ReferenceSql);
          if (pending) {
            rows.push(pending);
            pending = null;
          }
          calls.push("commit");
          return r;
        } catch (e) {
          pending = null;
          calls.push("rollback");
          throw e;
        } finally {
          inside = false;
        }
      },
    },
  );
  const sources = referenceSources()
    .filter((s) =>
      cfg.marketReference.availabilityBookmakers.includes(s.bookmaker),
    )
    .map((s) => ({
      ...s,
      rules,
      prices: {
        "Fictional Home": "2.00",
        Draw: "3.80",
        "Fictional Away": "4.00",
      },
      sourceAt: "2026-10-04T01:00:00Z",
      snapshotAt: "2026-10-04T01:00:01Z",
      receivedAt: "2026-10-04T01:00:01Z",
      provenance: "current_provider" as const,
    }));
  const module = {
    exports: {} as typeof import("../../src/server/football-scanner") &
      Pick<
        typeof import("../../src/server/model-ledger"),
        "recordFootballPrediction"
      > &
      Pick<typeof import("../../src/server/edge-scanner"), "scannerOperation">,
  };
  runInNewContext(await source(), {
    module,
    exports: module.exports,
    require: createRequire(path.resolve("package.json")),
    process: { env: { NODE_ENV: "test", DOCKED_CODE_COMMIT: commit } },
    Buffer,
    URL,
    Date,
    setTimeout,
    clearTimeout,
    __sql: sql,
    __load: async () => {
      calls.push("market-price-load");
      assert.ok(rows.length, "Prediction evidence must already be committed");
      assert.equal(pending, null);
      assert.ok(calls.includes("commit"));
      if (throwMarket) throw Error("Fixture market unavailable");
      return {
        market: {
          id: "fictional-market",
          rules,
          start_at: new Date(start),
          observed_at: new Date(at),
        },
        sources,
        configuration: cfg.marketReference,
      };
    },
    __retain: async () => {
      calls.push("retain-reference");
      return "fictional-reference";
    },
    fetch: () => {
      network++;
      throw Error("Network forbidden in isolated test");
    },
  });
  return {
    api: module.exports,
    sql: sql as unknown as ReferenceSql,
    calls,
    rows,
    network: () => network,
    failMarket: () => {
      throwMarket = true;
    },
  };
}
test("actual no-model evaluator cannot touch market data or provider transport", async () => {
  const r = await runtime();
  assert.equal(
    (
      await r.api.evaluateFootballCandidate(r.sql, {
        ...comparisonInput,
        predictionId: undefined,
      })
    ).ready,
    false,
  );
  assert.equal(r.calls.length, 0);
  const p = await r.api.recordFootballPrediction(recordInput);
  assert.equal(p.status, "NOT_CONFIGURED");
  assert.equal(r.rows.length, 1);
  assert.ok(r.calls.includes("commit"));
  const checked = await r.api.evaluateFootballCandidate(r.sql, comparisonInput);
  assert.equal(checked.ready, false);
  assert.ok(
    !r.calls.some(
      (c) =>
        c.includes("market-price-load") || c.includes("from private.markets"),
    ),
  );
  assert.equal(r.network(), 0);
});
test("actual retained prediction commits before comparison; zero draw leaves home comparison valid", async () => {
  const r = await runtime(readyRow());
  const prediction = await r.api.recordFootballPrediction(recordInput);
  assert.equal(prediction.status, "READY");
  const checked = await r.api.evaluateFootballCandidate(r.sql, comparisonInput);
  assert.equal(checked.ready, true);
  if (!checked.ready) assert.fail();
  assert.equal(checked.candidate.selection, "Fictional Home");
  assert.equal(checked.candidate.probability, "0.58");
  assert.equal(checked.candidate.ev, "0.16");
  assert.equal(checked.candidate.reference.pricing, null);
  assert.ok(r.calls.indexOf("commit") < r.calls.indexOf("market-price-load"));
  assert.equal(r.network(), 0);
});
test("comparison failure cannot roll back the committed prediction", async () => {
  const r = await runtime(readyRow());
  await r.api.recordFootballPrediction(recordInput);
  r.failMarket();
  await assert.rejects(
    r.api.evaluateFootballCandidate(r.sql, comparisonInput),
    /Fixture market unavailable/,
  );
  assert.equal(r.rows.length, 1);
  assert.equal(r.rows[0].probabilities.home, "0.58");
  assert.equal(r.network(), 0);
});
test("all-event prediction pass records abstention without requiring a market row", async () => {
  const r = await runtime();
  const complete = await r.api.recordDueFootballPredictions(
    {
      id: jobId,
      lease_token: lease,
      payload: {
        strategyId: cfg.version,
        competition: "soccer_epl",
        horizonSeconds: 21600,
      },
    },
    new Date(at),
    Date.now() + 60000,
  );
  assert.equal(complete, true);
  assert.equal(r.rows.length, 1);
  assert.equal(r.rows[0].status, "NOT_CONFIGURED");
  assert.ok(
    r.calls.some((c) => c.includes("from private.events e cross join")),
  );
  assert.ok(!r.calls.includes("market-price-load"));
  assert.equal(r.network(), 0);
});
test("actual approval API rejects numerical overrides before authentication or database access", async () => {
  const r = await runtime();
  for (const extra of [
    { probability: "0.99" },
    { probabilities: { home: "0.99", draw: "0.005", away: "0.005" } },
    { odds: "20" },
    { minimumOdds: "1.01" },
    { requiredEV: "0" },
  ])
    await assert.rejects(
      r.api.scannerOperation({
        action: "approve",
        id: jobId,
        reason: "Fictional contract review only",
        ...extra,
      }),
    );
  assert.equal(r.calls.length, 0);
  assert.equal(r.network(), 0);
});

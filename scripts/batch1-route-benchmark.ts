/** Actual handlers and PostgreSQL on one disconnected restored snapshot.
 * Authentication alone is simulated. Every case rolls back to identical data.
 * No hosted/Android/network claim; no credentials, provider calls or live writes.
 */
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { batch1Database, batch1WireTraffic } from "./lib/batch1-isolated-db";
import { batch1RouteFixture } from "./lib/batch1-route-fixture";
import { localEnvironment, nestedSql } from "./batch1-route-smoke";
import { wallet } from "../src/core/credits-sandbox";

const directory = "docs/qa/batch1-pack-phone-20261116";
const nineOnly = process.argv.includes("--nine-card-only");
const suffix = nineOnly ? "-nine-card" : "";
const migrations = [
  "20261115113306_batch_private_pack_issuance_validation.sql",
  "20261115211545_batch1_pack_guard_batching.sql",
  "20261115235000_batch1_persistence_subdocuments.sql",
];
const fingerprint = async (sql: any) =>
  (
    await sql`select jsonb_build_object(
 'state',(select md5(document::text) from credits_sandbox.state where id),
 'journal',(select count(*) from credits_sandbox.journal),
 'history',(select count(*) from credits_sandbox.history),
 'allocations',(select count(*) from beta_packs.issued),
 'definitions',(select count(*) from commercial_billing.definitions),
 'issued',(select sum(issued) from commercial_billing.definitions),
 'inventory',(select md5(string_agg(user_id::text||sport||cards::text,',' order by user_id,sport)) from sports_feed.sport_sandbox_inventory)
 ) value`
  )[0].value;
const percentile = (values: number[], q: number) =>
  [...values].sort((a, b) => a - b)[Math.ceil(values.length * q) - 1];

async function main() {
  localEnvironment();
  mkdirSync(directory, { recursive: true });
  const phases = process.argv.includes("--candidate-only")
    ? ["candidate"]
    : process.argv.includes("--baseline-only")
      ? ["baseline"]
      : ["baseline", "candidate"];
  for (const phase of phases) {
    const sql = batch1Database("postgres");
    const route = await batch1RouteFixture(phase === "baseline");
    const rows: any[] = [];
    const before = await fingerprint(sql);
    const rollback = Error("expected benchmark rollback");
    try {
      await sql
        .begin(async (tx) => {
          if (phase === "candidate")
            for (const name of migrations)
              await tx.unsafe(
                readFileSync(`supabase/migrations/${name}`, "utf8"),
              );
          const identities =
            await tx`select a.user_id,a.kind,(select s.id from auth.sessions s where s.user_id=a.user_id and (a.kind<>'owner' or s.aal='aal2') order by updated_at desc limit 1) session_id from credits_sandbox.access a where a.enabled and (a.kind='owner' or a.user_id='d6ab4838-7108-4c50-8ab8-c5947ab55bd8'::uuid) order by a.kind='owner' desc`;
          assert.equal(identities.length, 2);
          // Auth sessions can be absent from a logical snapshot after logout. Supply
          // a synthetic session row ONLY in this rollback fixture; do not bypass the
          // real pre-admission/session validation functions or expand access.
          for (const identity of identities)
            if (!identity.session_id) {
              identity.session_id = randomUUID();
              await tx`insert into auth.sessions(id,user_id,created_at,updated_at,aal) values(${identity.session_id}::uuid,${identity.user_id}::uuid,now(),now(),'aal1')`;
            }
          // Existing founder balance is 4,800, below the unchanged 5,000 offer.
          // Add exactly 1,000 synthetic credits through guarded ledger logic, ONLY
          // inside this rollback transaction, identically before both benchmark phases.
          await tx`set local role docked_beta_app`;
          await route.run(
            {
              sql: nestedSql(tx),
              who: {
                user: { id: String(identities[0].user_id) },
                aal: "aal2",
                sessionId: identities[0].session_id,
              },
            },
            () => route.fixtureFunding(),
          );
          await tx`reset role`;
          const [{ document: initial }] =
            await tx`select document from credits_sandbox.state where id`;
          const products = Object.values(
            initial.economy.products as Record<string, any>,
          )
            .filter(
              (p) =>
                p.cataloguePolicy === "founder-credit-season-v1" &&
                ["nfl", "afl", "nrl"].includes(p.sport) &&
                ["STANDARD", "PREMIUM"].includes(p.type) &&
                (nineOnly ? p.cards === 9 : [1, 3, 9].includes(p.cards)),
            )
            .sort((a, b) =>
              (a.sport + a.type + a.cards).localeCompare(
                b.sport + b.type + b.cards,
              ),
            );
          assert.equal(products.length, nineOnly ? 6 : 18);
          // All 18 offers for each existing approved account type.
          const cases = Array.from({ length: nineOnly ? 3 : 1 }, () => [
            ...products,
            ...products,
          ]).flat();
          for (const [index, p] of cases.entries()) {
            const identity =
                identities[Math.floor(index / products.length) % 2],
              who = {
                user: { id: String(identity.user_id) },
                aal: identity.kind === "owner" ? "aal2" : "aal1",
                sessionId: identity.session_id,
              };
            await tx
              .savepoint(async (child) => {
                await child`set local role docked_beta_app`;
                const id = randomUUID();
                const command = {
                  request: id,
                  command: {
                    kind: "buy-pack",
                    product: p.id,
                    configuration: p.version,
                    confirmed: true,
                    policy: initial.policy.version,
                    expectedPrice: p.priceCredits,
                  },
                };
                const outcomes: any[] = [];
                for (const [action, body] of [
                  ["confirmation", command],
                  ["saved-recovery", command],
                  [
                    "reveal",
                    {
                      request: randomUUID(),
                      command: { kind: "open-pack", entitlement: id },
                    },
                  ],
                ] as const) {
                  const wireBefore = { ...batch1WireTraffic };
                  const start = performance.now(),
                    errors: any[] = [];
                  const response = await route.run(
                    { sql: nestedSql(child), who, errors },
                    () =>
                      route.POST(
                        new Request(
                          "http://127.0.0.1:3033/api/test-wallet?view=packs&result=receipt",
                          {
                            method: "POST",
                            headers: {
                              "Content-Type": "application/json",
                              Origin: "http://127.0.0.1:3033",
                            },
                            body: JSON.stringify(body),
                          },
                        ),
                      ),
                  );
                  const handlerEnd = performance.now();
                  const text = await response.text();
                  const bodyEnd = performance.now();
                  const result = JSON.parse(text);
                  const parseEnd = performance.now();
                  const elapsed = parseEnd - start;
                  const outcome = {
                    action,
                    durationMs: Math.round(elapsed),
                    status: response.status,
                    bytes: Buffer.byteLength(text),
                    handlerMs: Math.round(handlerEnd - start),
                    responseBodyReadMs:
                      Math.round((bodyEnd - handlerEnd) * 100) / 100,
                    responseJsonParseMs:
                      Math.round((parseEnd - bodyEnd) * 100) / 100,
                    databaseWire: Object.fromEntries(
                      Object.entries(batch1WireTraffic).map(([key, value]) => [
                        key,
                        value - wireBefore[key as keyof typeof wireBefore],
                      ]),
                    ),
                    timings: response.headers.get("Server-Timing"),
                    ...(response.status !== 200 ? { error: result.error } : {}),
                  };
                  outcomes.push(outcome);
                  if (response.status !== 200) {
                    if (phase === "baseline" && action === "reveal") continue;
                    throw Error(
                      `${phase}/${p.sport}/${p.type}/${p.cards}/${action}: ${JSON.stringify(errors)}`,
                    );
                  }
                  const view = result.packUpdate ?? result.state;
                  const pack =
                    result.packUpdate?.pack ??
                    view.packs.find((x: any) => x.id === id);
                  assert.equal(pack.cardCount, p.cards);
                  assert.equal(
                    view.wallet.available,
                    wallet(initial, who.user.id).available - p.priceCredits,
                  );
                }
                const [{ document: state }] =
                  await child`select document from credits_sandbox.state where id`;
                assert.equal(state.journal.length, initial.journal.length + 1);
                assert.equal(state.economy.packs[id].cards.length, p.cards);
                // Independent observer only; the handler above used the restricted role.
                await child`reset role`;
                const [counts] =
                  await child`select count(*)::int n,count(distinct card)::int unique_cards from beta_packs.issued where pack=${id}`;
                assert.equal(counts.n, p.cards);
                assert.equal(counts.unique_cards, p.cards);
                rows.push({
                  sport: p.sport,
                  type: p.type,
                  cards: p.cards,
                  price: p.priceCredits,
                  account: identity.kind === "owner" ? "founder" : "Brenton",
                  ...(nineOnly
                    ? {
                        repetition:
                          Math.floor(index / (2 * products.length)) + 1,
                      }
                    : {}),
                  outcomes,
                });
                writeFileSync(
                  `${directory}/benchmark-${phase}${suffix}-progress.json`,
                  JSON.stringify({ phase, rows }, null, 2),
                );
                console.log(
                  JSON.stringify({
                    phase,
                    case: index + 1,
                    sport: p.sport,
                    type: p.type,
                    cards: p.cards,
                    outcomes: outcomes.map(
                      ({ action, durationMs, status }) => ({
                        action,
                        durationMs,
                        status,
                      }),
                    ),
                  }),
                );
                throw rollback;
              })
              .catch((e) => {
                if (e !== rollback) throw e;
              });
          }
          throw rollback;
        })
        .catch((e) => {
          if (e !== rollback) throw e;
        });
      assert.deepEqual(await fingerprint(sql), before);
      const summary = Object.fromEntries(
        ["confirmation", "saved-recovery", "reveal"].map((action) => {
          const values = rows
            .flatMap((r) => r.outcomes)
            .filter((r) => r.action === action && r.status === 200)
            .map((r) => r.durationMs);
          return [
            action,
            {
              n: values.length,
              p50Ms: percentile(values, 0.5),
              p95Ms: percentile(values, 0.95),
              maxMs: Math.max(...values),
            },
          ];
        }),
      );
      writeFileSync(
        `${directory}/benchmark-${phase}${suffix}.json`,
        JSON.stringify(
          {
            at: new Date().toISOString(),
            phase,
            scope:
              "Actual API handler; restored PostgreSQL; simulated Auth; Windows Node and Docker stdin transport; not hosted or physical-device latency",
            snapshot:
              "86d4213d8ef4620e30173c03ab91d2bf883f8c8c4a5bb1208b98b090357203ba",
            jit: "off",
            workMem: "3500kB",
            equalStartingDataEachCase: true,
            rollbackVerified: true,
            before,
            summary,
            rows,
          },
          null,
          2,
        ),
      );
      console.log(JSON.stringify({ phase, summary }));
    } finally {
      await sql.end({ timeout: 5 });
    }
  }
}
void main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});

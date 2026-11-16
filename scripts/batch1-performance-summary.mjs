import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
const directory = "docs/qa/batch1-pack-phone-20261116/";
const read = (name) => JSON.parse(readFileSync(directory + name, "utf8"));
const before = read("benchmark-baseline.json"),
  after = read("benchmark-candidate.json");
assert.equal(before.snapshot, after.snapshot);
assert(before.rollbackVerified && after.rollbackVerified);
assert.deepEqual(before.before, after.before);
assert.deepEqual(
  before.rows.map(({ sport, type, cards, price, account }) => ({
    sport,
    type,
    cards,
    price,
    account,
  })),
  after.rows.map(({ sport, type, cards, price, account }) => ({
    sport,
    type,
    cards,
    price,
    account,
  })),
);
const summary = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  return {
    n: sorted.length,
    p50: sorted[Math.ceil(sorted.length * 0.5) - 1] ?? null,
    p95: sorted[Math.ceil(sorted.length * 0.95) - 1] ?? null,
    max: sorted.at(-1) ?? null,
  };
};
function stages(phase, action) {
  const rows = phase.rows.flatMap((row) =>
    row.outcomes.filter((o) => o.action === action),
  );
  const timings = rows.map((o) =>
    Object.fromEntries(
      [...String(o.timings).matchAll(/([a-z_]+);dur=([\d.]+)/g)].map((m) => [
        m[1],
        Number(m[2]),
      ]),
    ),
  );
  return {
    successful: rows.filter((o) => o.status === 200).length,
    failures: rows
      .filter((o) => o.status !== 200)
      .map((o) => ({ status: o.status, error: o.error })),
    handlerMs: summary(rows.map((o) => o.handlerMs)),
    responseBodyReadMs: summary(rows.map((o) => o.responseBodyReadMs)),
    responseJsonParseMs: summary(rows.map((o) => o.responseJsonParseMs)),
    responseBytes: summary(rows.map((o) => o.bytes)),
    databaseSentBytes: summary(rows.map((o) => o.databaseWire.sentBytes)),
    databaseReceivedBytes: summary(
      rows.map((o) => o.databaseWire.receivedBytes),
    ),
    serverStagesMs: Object.fromEntries(
      [...new Set(timings.flatMap(Object.keys))].map((key) => [
        key,
        summary(timings.map((t) => t[key]).filter((v) => v !== undefined)),
      ]),
    ),
  };
}
const presentation = read("presentation-benchmark.json"),
  stress = read("postgres-acceptance.json");
const nineRun = read("benchmark-candidate-nine-card.json");
assert.equal(nineRun.rows.length, 36);
assert.equal(nineRun.rollbackVerified, true);
assert.deepEqual(nineRun.before, after.before);
const groups = new Map();
for (const row of nineRun.rows) {
  assert.equal(row.cards, 9);
  const key = [row.sport, row.type, row.account].join(":");
  groups.set(key, (groups.get(key) ?? 0) + 1);
  assert(row.outcomes.every((o) => o.status === 200));
}
assert.equal(groups.size, 12);
assert([...groups.values()].every((n) => n === 3));
const nineSummary = (rows) =>
  Object.fromEntries(
    ["confirmation", "saved-recovery", "reveal"].map((action) => [
      action,
      summary(
        rows.flatMap((row) =>
          row.outcomes
            .filter((o) => o.action === action)
            .map((o) => o.durationMs),
        ),
      ),
    ]),
  );
const nineAcceptance = {
  design:
    "Fixed 36-case supplement: three repetitions of every nine-card offer/account combination. All original 12 nine-card cases retained in the combined result.",
  supplemental: nineSummary(nineRun.rows),
  combined: nineSummary([
    ...after.rows.filter((row) => row.cards === 9),
    ...nineRun.rows,
  ]),
};
const result = {
  at: new Date().toISOString(),
  snapshot: before.snapshot,
  environment:
    "Windows Node 22.14.0; network-isolated restored PostgreSQL; actual handlers/guards; simulated Auth; Docker stdin database transport",
  limitation:
    "Equivalent-data timing uses outer rollback/savepoints and excludes durable COMMIT/fsync and hosted Auth/Internet latency. Real committed integrity is tested separately. Not physical Android acceptance.",
  target: { confirmationP95BelowMs: 5000, savedRecoveryP95BelowMs: 2000 },
  before: before.summary,
  after: after.summary,
  targetsMet:
    after.summary.confirmation.p95Ms < 5000 &&
    after.summary["saved-recovery"].p95Ms < 2000 &&
    nineAcceptance.supplemental.confirmation.p95 < 5000 &&
    nineAcceptance.combined.confirmation.p95 < 5000 &&
    nineAcceptance.supplemental["saved-recovery"].p95 < 2000 &&
    nineAcceptance.combined["saved-recovery"].p95 < 2000,
  nineCardAcceptance: nineAcceptance,
  nineCardOffers: Object.fromEntries(
    [
      ["before", before],
      ["after", after],
    ].map(([name, phase]) => [
      name,
      Object.fromEntries(
        ["confirmation", "saved-recovery", "reveal"].map((action) => [
          action,
          summary(
            phase.rows
              .filter((row) => row.cards === 9)
              .flatMap((row) =>
                row.outcomes
                  .filter((o) => o.action === action && o.status === 200)
                  .map((o) => o.durationMs),
              ),
          ),
        ]),
      ),
    ]),
  ),
  stages: Object.fromEntries(
    ["confirmation", "saved-recovery", "reveal"].map((action) => [
      action,
      { before: stages(before, action), after: stages(after, action) },
    ]),
  ),
  stageCaution:
    "The baseline purchase_lock includes state reading; candidate separates purchase_lock and purchase_state. Server stages overlap (transaction contains issue/persist); do not add their p95s. Database wire bytes are not Internet transfer time.",
  browserPresentation: presentation,
  concurrentDuplicateStress: {
    requests: stress.purchaseDuplicateRequests,
    durationsMs: summary(stress.duplicateDurationsMs),
    restartRecoveryMs: stress.restartRecoveryMs,
    integrityPassed: stress.passed,
    caveat:
      "24 in-flight duplicates measure contention, not the sequential product matrix or an already-committed saved receipt.",
  },
};
writeFileSync(
  directory + "performance-summary.json",
  JSON.stringify(result, null, 2) + "\n",
);
console.log(
  JSON.stringify({
    before: result.before,
    after: result.after,
    targetsMet: result.targetsMet,
  }),
);

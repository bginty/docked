import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { resolve } from "node:path";
import { writeFileSync } from "node:fs";
import assert from "node:assert/strict";
import { once } from "node:events";
import { multiSportDatabase } from "../tests/fixtures/multi-sport-db";
import { pgliteSql } from "../tests/fixtures/pglite-sql";
import { pullSportPage } from "../src/server/multisport-refresh";
import { feedRequest } from "../src/server/multisport-feed-http";
import {
  ingestionHealth,
  ingestionDiagnostics,
  ingestionJobs,
} from "../src/core/multisport-health";
async function main() {
  assert.equal(
    process.env.NODE_ENV,
    "test",
    "Loopback acceptance requires test environment",
  );
  const [repo, python] = process.argv.slice(2);
  if (!repo || !python) throw Error("Service repository and Python required");
  const child = spawn(
    python,
    [resolve(repo, "scripts/serve_docked_contract_fixture.py")],
    { cwd: repo, stdio: ["pipe", "pipe", "pipe"] },
  );
  const lines = createInterface({ input: child.stdout })[
    Symbol.asyncIterator
  ]();
  let stderr = "";
  child.stderr.on("data", (d) => {
    stderr += d.toString();
  });
  const timeout = setTimeout(() => child.kill(), 60000);
  const db = await multiSportDatabase();
  try {
    const line = await lines.next();
    assert(!line.done, stderr);
    const ready = JSON.parse(line.value);
    assert.match(ready.origin, /^http:\/\/127\.0\.0\.1:\d+$/);
    const config = {
        ...ready,
        key: "r".repeat(24),
        source: "isolated-http",
        allowSynthetic: true,
      },
      sql = pgliteSql(db.pg);
    await assert.rejects(
      feedRequest(
        { ...config, key: "x".repeat(24) },
        "/v1/sports/nba/stat-changes",
      ),
      /Feed HTTP/,
    );
    await assert.rejects(
      feedRequest(config, "/admin/multisport/status"),
      /Feed HTTP/,
    );
    const health = ingestionHealth.parse(
      await feedRequest(
        { ...config, key: "a".repeat(24) },
        "/admin/multisport/status",
      ),
    );
    assert(health.synthetic);
    for (const sport of ["epl", "nba", "afl", "nrl"] as const) {
      await pullSportPage(sql, config, sport);
      await pullSportPage(sql, config, sport);
      assert((await pullSportPage(sql, config, sport)).replay);
    }
    child.stdin.write("correct\n");
    assert.equal(JSON.parse((await lines.next()).value!).corrected, true);
    for (const sport of ["epl", "nba", "afl", "nrl"] as const)
      await pullSportPage(sql, config, sport);
    const rows = await db.q(
      "select sport,count(*)::int n,min(revision)::int revision from sports_feed.delivery_records where kind='player_game' group by sport order by sport",
    );
    assert.equal(rows.length, 4);
    assert(rows.every((r) => r.n === 2 && r.revision === 2));
    await assert.rejects(
      feedRequest(config, "/admin/multisport/diagnostics"),
      /Feed HTTP/,
    );
    const admin = { ...config, key: "a".repeat(24) };
    const diagnostics = ingestionDiagnostics.parse(
      await feedRequest(admin, "/admin/multisport/diagnostics"),
    );
    assert.equal(diagnostics.dataset_id, health.dataset_id);
    assert.equal(diagnostics.data.coverage.length, 4);
    assert(
      diagnostics.data.coverage.every(
        (c) => c.fixtures === 2 && c.imported === 2,
      ),
    );
    assert.equal(diagnostics.data.corrections.length, 8);
    const jobs = ingestionJobs.parse(
      await feedRequest(admin, "/admin/multisport/jobs"),
    ).data;
    writeFileSync(
      "tmp/ingestion-browser-fixture.json",
      JSON.stringify({
        health: ingestionHealth.parse(
          await feedRequest(admin, "/admin/multisport/status"),
        ),
        jobs,
        diagnostics,
      }),
    );
    const report = {
      at: new Date().toISOString(),
      transport: "actual loopback HTTP",
      hosted: false,
      synthetic: true,
      sports: rows,
      authenticationNegativeChecks: 3,
      diagnosticsContract: true,
      emptyPollReplay: true,
      correction: true,
    };
    writeFileSync(
      "docs/qa/multi-sport/integration/http-contract.json",
      JSON.stringify(report, null, 2),
    );
    console.log(JSON.stringify(report));
  } finally {
    child.stdin.end();
    await Promise.race([
      once(child, "exit"),
      new Promise<void>((r) =>
        setTimeout(() => {
          child.kill();
          r();
        }, 2000),
      ),
    ]);
    clearTimeout(timeout);
    await db.pg.close();
  }
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});

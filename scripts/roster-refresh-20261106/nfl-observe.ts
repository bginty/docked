/** Local official source observation only. No database, supply approval, live
 * refresh, provider credential or deployment. Existing cached bytes are reused
 * without assigning a new retrieval time or making another network request. */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { officialUrl } from "../../src/core/official-roster-refresh";

const directory = "private-data/roster-refresh-20261106/nfl";
const evidence = "docs/qa/roster-refresh-20261106/nfl";
const sha = (bytes: Buffer | string) =>
  createHash("sha256").update(bytes).digest("hex");
async function main() {
  assert.equal(process.argv[2], "--observe-nfl-only");
  mkdirSync(directory, { recursive: true });
  mkdirSync(evidence, { recursive: true });
  const observations = [];
  let requests = 0;
  for (const team of ["ARI", "MIA", "TEN"]) {
    const recordPath = `${directory}/${team}.json`;
    if (existsSync(recordPath)) {
      const record = JSON.parse(readFileSync(recordPath, "utf8"));
      if (record.status === "observed")
        assert.equal(sha(readFileSync(record.file)), record.sha256);
      observations.push(record);
      continue;
    }
    const url = officialUrl(team);
    assert(url);
    const record: Record<string, unknown> = {
      team,
      url,
      requestedAt: new Date().toISOString(),
      status: "started",
      sourceClass: "existing-official-factual-roster",
      credentials: false,
    };
    writeFileSync(recordPath, JSON.stringify(record, null, 2) + "\n");
    requests++;
    try {
      const response = await fetch(url, {
        redirect: "error",
        signal: AbortSignal.timeout(20000),
        headers: { Accept: "text/html" },
      });
      record.httpStatus = response.status;
      if (!response.ok) {
        await response.body?.cancel();
        throw Error("Official source unavailable");
      }
      const body = await response.text();
      assert.ok(
        body.length <= 5_000_000,
        "Source exceeds existing safety limit",
      );
      const file = `${directory}/${team}.html`;
      writeFileSync(file, body);
      Object.assign(record, {
        status: "observed",
        fetchedAt: new Date().toISOString(),
        sha256: sha(body),
        bytes: Buffer.byteLength(body),
        file,
      });
    } catch {
      Object.assign(record, {
        status: "unavailable-or-restricted",
        failedAt: new Date().toISOString(),
      });
    }
    writeFileSync(recordPath, JSON.stringify(record, null, 2) + "\n");
    observations.push(record);
  }
  const report = {
    at: new Date().toISOString(),
    scope:
      "New independently observed local NFL official source snapshot; raw HTML stays private",
    networkRequestsThisRun: requests,
    retries: 0,
    productionWrites: 0,
    approvals: 0,
    inventoryIssued: 0,
    observations: observations.map(({ file: _file, ...record }) => record),
  };
  writeFileSync(
    `${evidence}/source-observations.json`,
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(JSON.stringify(report, null, 2));
}
main().catch((error) => {
  console.error(
    error instanceof assert.AssertionError
      ? error.message
      : "Local source observation failed",
  );
  process.exitCode = 1;
});

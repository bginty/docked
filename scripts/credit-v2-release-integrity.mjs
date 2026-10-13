import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { ownerDatabase } from "./owner-gameplay-db.mjs";
const db = ownerDatabase();
try {
  const baseline = JSON.parse(readFileSync("docs/qa/credit-v2/before.json"));
  const [old] =
    await db`select document from credits_sandbox.history where revision=${Number(baseline.snapshot.revision)}`;
  const [current] =
    await db`select revision,document from credits_sandbox.state where id`;
  assert.ok(old, "Retained baseline revision required");
  const hash = (v) =>
    createHash("sha256").update(JSON.stringify(v)).digest("hex");
  const changed = Object.keys(current.document).filter(
    (k) => hash(old.document[k]) !== hash(current.document[k]),
  );
  assert.ok(
    changed.every((k) => ["events", "requests"].includes(k)),
    "Only QA replay audit events/request receipts may change",
  );
  const qa = JSON.parse(
    readFileSync("private-data/customer-hosted-qa/identity.json"),
  );
  const history =
    await db`select revision,actor from credits_sandbox.history where revision>${Number(baseline.snapshot.revision)} order by revision`;
  assert.ok(history.every((x) => x.actor === qa.id));
  console.log(
    JSON.stringify({
      changed,
      qaRevisionsOnly: true,
      revisions: history.map((x) => x.revision),
    }),
  );
  writeFileSync(
    "docs/qa/credit-v2/release-integrity.json",
    JSON.stringify(
      {
        at: new Date().toISOString(),
        baselineRevision: baseline.snapshot.revision,
        currentRevision: current.revision,
        changedTopLevelFields: changed,
        qaRevisionsOnly: true,
        holdingsBalancesGrantsSupplyAndLedgerUnchanged: true,
      },
      null,
      2,
    ) + "\n",
  );
} finally {
  await db.end();
}

// Offline streaming field-level drift review. Raw COPY records are never saved.
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, createReadStream } from "node:fs";
import { createDecipheriv, createHash } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import { createInterface } from "node:readline";
import { pipeline } from "node:stream/promises";
const out = "docs/qa/v31-prelaunch-execution-20261111/database";
const drift = JSON.parse(
  readFileSync(`${out}/fresh-drift-review.json`, "utf8"),
);
const tables = drift.changedTables
  .map((t) => t.table)
  .filter((t) => !t.startsWith('"net".'));
const result = spawnSync(
  "docker",
  [
    "exec",
    "docked-commercial-restore-20261111",
    "psql",
    "-h",
    "/restore",
    "-U",
    "postgres",
    "-d",
    "postgres",
    "-At",
    "-c",
    `select jsonb_object_agg(t.name,t.columns) from (select '"'||n.nspname||'"."'||c.relname||'"' name,jsonb_agg(a.attname order by k.ord) columns from pg_index i join pg_class c on c.oid=i.indrelid join pg_namespace n on n.oid=c.relnamespace cross join unnest(i.indkey) with ordinality k(attnum,ord) join pg_attribute a on a.attrelid=c.oid and a.attnum=k.attnum where i.indisprimary group by n.nspname,c.relname)t`,
  ],
  { encoding: "utf8", windowsHide: true },
);
assert.equal(result.status, 0);
const pk = JSON.parse(result.stdout),
  hash = (v) => createHash("sha256").update(v).digest("hex");
const key = Buffer.from(
  readFileSync(
    `${process.env.USERPROFILE}/.docked-secrets/launch-migration-backup-key.hex`,
    "utf8",
  ).trim(),
  "hex",
);
async function archive(dir) {
  const raw = readFileSync(`${dir}/manifest.aes`),
    m = createDecipheriv("aes-256-gcm", key, raw.subarray(0, 12));
  m.setAuthTag(raw.subarray(12, 28));
  const meta = JSON.parse(
    Buffer.concat([m.update(raw.subarray(28)), m.final()]).toString(),
  );
  const d = createDecipheriv("aes-256-gcm", key, Buffer.from(meta.iv, "hex"));
  d.setAuthTag(Buffer.from(meta.tag, "hex"));
  const p = spawn(
    "docker",
    [
      "exec",
      "-i",
      "supabase_db_deletion-auth-local",
      "pg_restore",
      "--data-only",
      "--file=-",
      ...tables.flatMap((t) => [
        "--table",
        t.split(".")[1].replaceAll('"', ""),
      ]),
    ],
    { stdio: ["pipe", "pipe", "pipe"], windowsHide: true },
  );
  p.stderr.resume();
  const done = new Promise((resolve, reject) => {
    p.once("close", resolve);
    p.once("error", reject);
  });
  const pipe = pipeline(
    createReadStream(`${dir}/production.dump.aes`),
    d,
    p.stdin,
  ).catch((e) => e);
  const data = new Map(tables.map((t) => [t, new Map()]));
  let table = null,
    cols = [];
  for await (const line of createInterface({
    input: p.stdout,
    crlfDelay: Infinity,
  })) {
    const start = /^COPY ([a-z_]+)\.([a-z_]+) \((.+)\) FROM stdin;$/.exec(line);
    if (start) {
      table = `"${start[1]}"."${start[2]}"`;
      cols = start[3].split(", ");
      continue;
    }
    if (line === "\\.") {
      table = null;
      continue;
    }
    if (!data.has(table)) continue;
    const values = line.split("\t");
    assert.equal(values.length, cols.length);
    assert(pk[table]?.length);
    const id = hash(
        JSON.stringify(pk[table].map((c) => values[cols.indexOf(c)])),
      ),
      rows = data.get(table);
    const row = { hash: hash(line) };
    if (
      ![
        '"cron"."job_run_details"',
        '"sports_feed"."weekly_core_job_runs"',
      ].includes(table)
    )
      row.fields = Object.fromEntries(cols.map((c, i) => [c, hash(values[i])]));
    row.labels = Object.fromEntries(
      cols.flatMap((c, i) =>
        ["environment", "sport", "rarity", "kind", "state", "source"].includes(
          c,
        ) && /^[a-zA-Z_ -]{1,40}$/.test(values[i])
          ? [[c, values[i]]]
          : [],
      ),
    );
    assert(!rows.has(id), "Duplicate archived key");
    rows.set(id, row);
  }
  assert.equal(await done, 0, "Local archive extraction failed");
  const pipeError = await pipe;
  if (
    pipeError &&
    !["EPIPE", "EOF", "ERR_STREAM_PREMATURE_CLOSE"].includes(pipeError.code)
  )
    throw pipeError;
  return data;
}
try {
  const prior = await archive("private-data/commercial-restore-20261110r"),
    fresh = await archive("private-data/commercial-restore-20261111");
  const details = tables.map((table) => {
    const old = prior.get(table),
      now = fresh.get(table),
      added = [...now].filter(([id]) => !old.has(id)),
      removed = [...old.keys()].filter((id) => !now.has(id)),
      fields = new Set();
    let updated = 0;
    for (const [id, before] of old) {
      const after = now.get(id);
      if (!after || before.hash === after.hash) continue;
      updated++;
      if (before.fields) {
        for (const c of Object.keys(before.fields))
          if (before.fields[c] !== after.fields[c]) fields.add(c);
      } else fields.add("[run-log contents]");
    }
    const labels = {};
    for (const [, r] of added)
      for (const [c, v] of Object.entries(r.labels)) {
        labels[c] ??= [];
        if (!labels[c].includes(v) && labels[c].length < 10) labels[c].push(v);
      }
    return {
      table,
      previousRows: old.size,
      currentRows: now.size,
      added: added.length,
      removed: removed.length,
      updated,
      changedColumns: [...fields].sort(),
      addedRowLabels: labels,
    };
  });
  const report = {
    at: new Date().toISOString(),
    previousSnapshot: drift.previousSnapshotAt,
    freshSnapshot: drift.freshSnapshotAt,
    details,
    originalCustodyTablesUnchanged: !tables.some((t) =>
      [
        '"credits_sandbox"."card_instances"',
        '"beta_fantasy"."cards"',
        '"beta_fantasy"."ownership_events"',
      ].includes(t),
    ),
    commercialTablesUnchanged: !tables.some((t) =>
      t.startsWith('"commercial_billing".'),
    ),
    supportedInventoryDelta:
      "Nine additional real AFL limited copies are held in the legacy fixture registry; TEST_ONLY receipt does not make their identities synthetic. Original879 remain unchanged; fresh lifetime baseline888. See card reconciliation for exact identity evidence.",
    scope:
      "Observed deltas only, not retrospective approval. Preserve every original and new issued copy; table names are not source eligibility evidence.",
    productionWrites: 0,
  };
  writeFileSync(
    `${out}/snapshot-data-drift.json`,
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(JSON.stringify(report));
} finally {
  key.fill(0);
}

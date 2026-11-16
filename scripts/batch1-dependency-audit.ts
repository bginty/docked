/** Read-only dependency audit. Does not change the frozen Preview proposal. */
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
const source = readFileSync(
  "private-data/batch1-hosted-20261116/schema-only.sql",
  "utf8",
);
assert(!/^COPY /m.test(source));
const prior = JSON.parse(
  readFileSync(
    "docs/qa/batch1-hosted-20261116/dependency-closure.json",
    "utf8",
  ),
);
const blocks = source
  .split(/(?=--\n-- Name: )/)
  .map((text) => {
    const h = text.match(
      /-- Name: (.+?); Type: ([^;]+); Schema: ([^;]+); Owner:/,
    );
    return h ? { name: h[1], type: h[2], schema: h[3], text } : null;
  })
  .filter((b): b is NonNullable<typeof b> => !!b);
const definitions = blocks.filter((b) =>
  [
    "TABLE",
    "FUNCTION",
    "VIEW",
    "TYPE",
    "SEQUENCE",
    "MATERIALIZED VIEW",
  ].includes(b.type),
);
const key = (b: (typeof blocks)[number]) =>
  b.schema + "." + b.name.split("(")[0];
const known = new Set(definitions.map(key));
function closure(roots: string[]) {
  const selected = new Set(roots),
    why = new Map<string, { from: string; type: string }>();
  let changed = true;
  while (changed) {
    changed = false;
    for (const b of blocks) {
      let parent = key(b),
        included = selected.has(parent);
      if (
        [
          "CONSTRAINT",
          "FK CONSTRAINT",
          "TRIGGER",
          "ROW SECURITY",
          "POLICY",
          "DEFAULT",
        ].includes(b.type)
      ) {
        parent = b.schema + "." + b.name.split(" ")[0];
        included = selected.has(parent);
      }
      if (b.type === "SEQUENCE") {
        const table = b.text.match(
          /ALTER TABLE ([a-z_]+\.[a-z_]+) ALTER COLUMN/,
        );
        if (table && selected.has(table[1])) {
          parent = table[1];
          included = true;
        }
      }
      if (b.type === "INDEX") {
        const table = b.text.match(/ ON ([a-z_]+\.[a-z_]+) /);
        included = !!table && selected.has(table[1]);
        if (included) parent = table![1];
      }
      if (!included) continue;
      for (const m of b.text.matchAll(/\b([a-z_]+)\.([a-z_][a-z_0-9]*)/g)) {
        const ref = m[1] + "." + m[2];
        if (
          known.has(ref) &&
          !["auth", "extensions", "pg_catalog", "information_schema"].includes(
            m[1],
          ) &&
          !selected.has(ref)
        ) {
          selected.add(ref);
          why.set(ref, { from: parent, type: b.type });
          changed = true;
        }
      }
    }
  }
  const tables = definitions
    .filter((b) => b.type === "TABLE" && selected.has(key(b)))
    .map(key)
    .sort();
  const paths = Object.fromEntries(
    tables.map((t) => {
      const chain = [{ object: t, edge: "table" }],
        seen = new Set([t]);
      let current = t;
      while (why.has(current)) {
        const p = why.get(current)!;
        if (seen.has(p.from)) break;
        chain.push({ object: p.from, edge: p.type });
        seen.add(p.from);
        current = p.from;
      }
      return [t, chain.reverse()];
    }),
  );
  return {
    roots,
    objects: [...selected].sort(),
    schemaCount: new Set([...selected].map((s) => s.split(".")[0])).size,
    tableCount: tables.length,
    tables,
    paths,
  };
}
const full = closure(prior.roots);
assert.deepEqual(full.objects, prior.objects);
const readers = [
  "sports_feed.open_weekly_core",
  "sports_feed.my_weekly_core",
  "beta_fantasy.owned_collection_page",
];
const packOnly = closure(
  prior.roots.filter((r: string) => !readers.includes(r)),
);
const stateOnly = closure(["credits_sandbox.state"]);
const dir = "docs/qa/batch1-beta-alignment-20261116";
mkdirSync(dir, { recursive: true });
writeFileSync(
  dir + "/dependency-closure.json",
  JSON.stringify(
    {
      at: new Date().toISOString(),
      roots: packOnly.roots,
      objects: packOnly.objects,
      schemas: [
        ...new Set(packOnly.objects.map((s) => s.split(".")[0])),
      ].sort(),
      missing: [],
      customerRowsExtracted: 0,
      productionConnections: 0,
    },
    null,
    2,
  ) + "\n",
);
writeFileSync(
  dir + "/dependency-audit.json",
  JSON.stringify(
    {
      at: new Date().toISOString(),
      method:
        "static conservative transitive references including all constraints, RLS and triggers; not a mathematical proof of a minimum",
      full,
      packOnly,
      stateOnly,
      removedForPackOnly: full.tables.filter(
        (t) => !packOnly.tables.includes(t),
      ),
      hostedWrites: 0,
    },
    null,
    2,
  ) + "\n",
);
console.log(
  JSON.stringify({
    fullTables: full.tableCount,
    packOnlyTables: packOnly.tableCount,
    stateOnlyTables: stateOnly.tableCount,
    fullSchemas: full.schemaCount,
    packOnlySchemas: packOnly.schemaCount,
    removedForPackOnly: full.tables.filter((t) => !packOnly.tables.includes(t)),
  }),
);

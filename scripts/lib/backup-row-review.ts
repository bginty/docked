import assert from "node:assert/strict";
import { copyText } from "./round-backup-compare";
export type BackupRow = Record<string, string | null>;
export function readArchivedRows(dump: string, table: string): BackupRow[] {
  assert.match(table, /^"[a-z_]+"\."[a-z_]+"$/);
  const name = table.replaceAll('"', "");
  const lines = dump.replaceAll("\r\n", "\n").split("\n");
  const headers = lines
    .map((line, i) => ({ line, i }))
    .filter((x) => x.line.startsWith(`COPY ${name} (`));
  assert.equal(headers.length, 1, "Expected one archived table block");
  const { line, i } = headers[0];
  assert(line.endsWith(") FROM stdin;"));
  const columns = line
    .slice(`COPY ${name} (`.length, -") FROM stdin;".length)
    .split(", ");
  assert(columns.every((c) => /^[a-z_][a-z0-9_]*$/.test(c)));
  const end = lines.indexOf("\\.", i + 1);
  assert(end > i);
  return lines.slice(i + 1, end).map((row) => {
    const values = row.split("\t");
    assert.equal(values.length, columns.length);
    return Object.fromEntries(columns.map((c, j) => [c, copyText(values[j])]));
  });
}
export function textRowsQuery(
  table: string,
  columns: { name: string; type: string }[],
) {
  assert.match(table, /^"[a-z_]+"\."[a-z_]+"$/);
  return `select jsonb_build_object(${columns
    .map((c) => {
      assert.match(c.name, /^[a-z_][a-z0-9_]*$/);
      const col = '"' + c.name + '"';
      return `'${c.name}',${c.type === "inet" ? `pg_catalog.inet_out(${col})::text` : c.type === "boolean" ? `case when ${col} is null then null when ${col} then 't' else 'f' end` : `${col}::text`}`;
    })
    .join(",")}) value from ${table}`;
}

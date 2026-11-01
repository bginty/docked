import assert from "node:assert/strict";

// PostgreSQL COPY text, not SQL string literals. Fail closed on unknown escapes.
export function copyText(value: string): string | null {
  if (value === "\\N") return null;
  let out = "";
  const escaped: Record<string, string> = {
    b: "\b",
    f: "\f",
    n: "\n",
    r: "\r",
    t: "\t",
    v: "\v",
    "\\": "\\",
  };
  for (let i = 0; i < value.length; i++) {
    if (value[i] !== "\\") {
      out += value[i];
      continue;
    }
    const next = value[++i];
    assert(next !== undefined, "Incomplete COPY escape");
    if (Object.hasOwn(escaped, next)) {
      out += escaped[next];
      continue;
    }
    const octal = value.slice(i).match(/^[0-7]{1,3}/)?.[0];
    assert(octal, "Unsupported COPY escape");
    out += String.fromCharCode(parseInt(octal, 8));
    i += octal.length - 1;
  }
  return out;
}

const columns = [
  "competition_id",
  "stream_id",
  "purpose",
  "fixtures",
  "locked_snapshot",
  "locked_at",
  "last_checked",
  "next_check",
  "issues",
  "lease_until",
];
export const roundTelemetry = ["last_checked", "next_check", "lease_until"];
export function immutableRound(row: Record<string, unknown>) {
  assert.deepEqual(
    Object.keys(row).sort(),
    [...columns].sort(),
    "Round schema changed",
  );
  const result = { ...row };
  for (const key of roundTelemetry) delete result[key];
  if (result.locked_at !== null)
    result.locked_at = new Date(String(result.locked_at)).toISOString();
  return result;
}
export function readRoundCopy(dump: string) {
  const lines = dump.replaceAll("\r\n", "\n").split("\n");
  const headers = lines
    .map((line, i) => ({ line, i }))
    .filter(({ line }) => line.startsWith("COPY sports_feed.nfl_rounds "));
  assert.equal(headers.length, 1, "Expected one archived NFL round COPY block");
  const { line, i } = headers[0];
  assert.equal(
    line,
    `COPY sports_feed.nfl_rounds (${columns.join(", ")}) FROM stdin;`,
  );
  const end = lines.indexOf("\\.", i + 1);
  assert(end > i, "Missing COPY terminator");
  return lines.slice(i + 1, end).map((line) => {
    const values = line.split("\t");
    assert.equal(values.length, columns.length);
    const row: Record<string, unknown> = Object.fromEntries(
      columns.map((col, index) => [col, copyText(values[index])]),
    );
    for (const key of ["fixtures", "locked_snapshot", "issues"])
      if (row[key] !== null) row[key] = JSON.parse(String(row[key]));
    return row;
  });
}
export function assertOnlyRoundTelemetryChanged(
  previous: Record<string, unknown>[],
  current: Record<string, unknown>[],
) {
  const stable = (rows: Record<string, unknown>[]) =>
    rows
      .map(immutableRound)
      .sort((a, b) =>
        String(a.competition_id).localeCompare(String(b.competition_id)),
      );
  assert.equal(
    new Set(previous.map((r) => r.competition_id)).size,
    previous.length,
    "Duplicate archived round",
  );
  assert.equal(
    new Set(current.map((r) => r.competition_id)).size,
    current.length,
    "Duplicate current round",
  );
  assert.deepEqual(
    stable(current),
    stable(previous),
    "NFL round business data changed since backup",
  );
  return stable(previous);
}

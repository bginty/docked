import test from "node:test";
import assert from "node:assert/strict";
import {
  copyText,
  readRoundCopy,
  assertOnlyRoundTelemetryChanged,
} from "../../scripts/lib/round-backup-compare";
const row = {
  competition_id: "id",
  stream_id: "nfl",
  purpose: "postgame",
  fixtures: [{ id: "g1" }],
  locked_snapshot: { salary: 4400000 },
  locked_at: "2026-10-30 10:00:00+00",
  last_checked: null,
  next_check: null,
  issues: [],
  lease_until: null,
};
test("backup COPY preserves nulls, literal backslashes and escaped controls", () => {
  assert.equal(copyText("\\N"), null);
  assert.equal(copyText("\\\\N"), "\\N");
  assert.equal(copyText("a\\tb\\n\\134"), "a\tb\n\\");
  assert.throws(() => copyText("bad\\x"));
  const cols = Object.keys(row);
  const values = cols.map((k) => {
    const v = row[k as keyof typeof row];
    return v === null
      ? "\\N"
      : (typeof v === "object" ? JSON.stringify(v) : String(v)).replaceAll(
          "\\",
          "\\\\",
        );
  });
  const parsed = readRoundCopy(
    `COPY sports_feed.nfl_rounds (${cols.join(", ")}) FROM stdin;\n${values.join("\t")}\n\\.\n`,
  );
  assert.deepEqual(parsed, [row]);
  assert.throws(() => readRoundCopy("COPY unknown FROM stdin;"));
});
test("only scheduler telemetry may drift; schedule, locks, issues and membership fail closed", () => {
  const changed = {
    ...row,
    last_checked: "2026-11-02T00:00:00Z",
    next_check: "2026-11-02T00:15:00Z",
    lease_until: "2026-11-02T00:06:00Z",
    locked_at: "2026-10-30T10:00:00.000Z",
  };
  assertOnlyRoundTelemetryChanged([row], [changed]);
  for (const modification of [
    { fixtures: [] },
    { locked_snapshot: {} },
    { locked_at: null },
    { issues: ["missing"] },
    { purpose: "other" },
    { stream_id: "other" },
    { competition_id: "new" },
  ])
    assert.throws(() =>
      assertOnlyRoundTelemetryChanged([row], [{ ...changed, ...modification }]),
    );
  assert.throws(() => assertOnlyRoundTelemetryChanged([row], []));
  assert.throws(() => assertOnlyRoundTelemetryChanged([row], [row, row]));
});

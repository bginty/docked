import test from "node:test";
import assert from "node:assert/strict";
import { DateTime } from "luxon";
import { ownerReportPeriod } from "../../src/core/owner-report-period";
test("owner period uses Sydney calendar dates, keeps scopes and safe deep links", () => {
  const now = DateTime.fromISO("2026-10-16T14:00:00Z");
  assert.deepEqual(
    ownerReportPeriod({ period: "7", sport: "nfl", scope: "beta" }, now),
    {
      period: "7",
      query: {
        period: "7",
        sport: "nfl",
        scope: "beta",
        start: "2026-10-11",
        end: "2026-10-17",
      },
    },
  );
  assert.equal(ownerReportPeriod({ period: "9999" }, now).period, "30");
  assert.equal(
    ownerReportPeriod({ start: "2026-09-01", end: "2026-09-08" }, now).period,
    "custom",
  );
  assert.equal(
    ownerReportPeriod({ period: "365" }, now).query.start,
    "2025-10-18",
  );
});

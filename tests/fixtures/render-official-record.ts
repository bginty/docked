import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { OfficialRecord } from "../../src/components/official-docked-record";
import type {
  OfficialDockedRecord,
  OfficialRecordRow,
} from "../../src/core/official-docked-record";
const rows: OfficialRecordRow[] = [
  "won",
  "lost",
  "void",
  "pending",
  "disputed",
].map((result, i) => ({
  publicationId: `test-only-${i}`,
  eventId: `test-only-event-${i}`,
  eventLabel:
    "DEMO fictional home versus fictional away — long event display name",
  publishedAt: `2026-10-0${i + 1}T01:00:00Z`,
  selection: `DEMO selection ${i}`,
  odds: "2.00",
  estimatedEv: "0.05",
  benchmarkStake: "1",
  evidence: "live_published",
  result: result as OfficialRecordRow["result"],
  netUnits:
    result === "won"
      ? "1"
      : result === "lost"
        ? "-1"
        : result === "void"
          ? "0"
          : null,
  settledAt: i < 3 ? `2026-10-0${i + 1}T05:00:00Z` : null,
  correctionCount: result === "lost" ? 1 : 0,
  modelVersion: "DEMO-football-v1",
}));
const render = (record: OfficialDockedRecord) =>
  renderToStaticMarkup(createElement(OfficialRecord, { record }));
process.stdout.write(
  JSON.stringify({
    empty: render({ status: "READY", officialRecordStart: null, rows: [] }),
    restricted: render({
      status: "RESTRICTED",
      officialRecordStart: null,
      rows: [],
    }),
    populated: render({
      status: "READY",
      officialRecordStart: rows[0].publishedAt,
      rows,
    }),
  }),
);

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseOfficialRoster,
  matchKnownRoster,
} from "../../src/core/official-roster-refresh";

const url = "https://www.azcardinals.com/team/players-roster/";
function table(
  section: string,
  count: number,
  offset = 0,
  quarterback = false,
) {
  return `<h4>${section}</h4><table><thead><tr><th>Player</th><th>#</th><th>Pos</th><th>HT</th></tr></thead><tbody>${Array.from({ length: count }, (_, i) => `<tr><td><a href="/team/players-roster/fixture-${offset + i}/">Fixture ${offset + i}</a></td><td>${i}</td><td>${quarterback && i === 0 ? "QB" : "WR"}</td><td>Fixture</td></tr>`).join("")}</tbody></table>`;
}
test("current Arizona-derived section structure preserves Active and quarantines PUP", () => {
  const rows = parseOfficialRoster(
    table("Active", 52, 0, true) +
      table("Active/Physically Unable to Perform", 1, 100) +
      table("Reserve/Injured", 10, 200) +
      table("Reserve/Injured; Designated for Return", 3, 300) +
      table("Practice Squad", 16, 400) +
      table("Practice Squad/Injured", 1, 500) +
      table("Practice Squad/International", 1, 600),
    url,
  );
  assert.equal(rows.length, 84);
  assert.equal(rows.filter((r) => r.status === "active").length, 52);
  assert.equal(
    rows.find((r) => r.section.includes("Physically"))?.status,
    "unknown",
  );
  assert.equal(rows.filter((r) => r.status === "reserve").length, 13);
  assert.equal(rows.filter((r) => r.status === "practice-squad").length, 18);
});
test("current Miami-derived structure does not turn PUP into an active player", () => {
  const rows = parseOfficialRoster(
    table("Active", 53, 0, true) +
      table("Active/Physically Unable to Perform", 1, 100) +
      table("Reserve/Injured", 5, 200) +
      table("Practice Squad", 16, 300),
    url,
  );
  assert.equal(rows.length, 75);
  assert.equal(rows.filter((r) => r.status === "active").length, 53);
  assert.equal(rows.filter((r) => r.status === "unknown").length, 1);
});
test("current Tennessee-derived structure leaves TRC explicitly unknown", () => {
  const rows = parseOfficialRoster(
    table("Active", 53, 0, true) +
      table("Reserve/Injured", 5, 100) +
      table("Reserve/Injured; Designated for Return", 3, 200) +
      table("Practice Squad", 16, 300) +
      table("TRC", 1, 400) +
      table("Practice Squad/International", 1, 500),
    url,
  );
  assert.equal(rows.length, 79);
  const unknown = rows.filter((r) => r.status === "unknown");
  assert.equal(unknown.length, 1);
  assert.equal(unknown[0].section, "TRC");
});
test("unknown or non-active groups cannot fill an undersized Active roster", () => {
  assert.throws(
    () => parseOfficialRoster(table("Unrecognised", 53, 0, true), url),
    /incomplete/,
  );
  assert.throws(
    () =>
      parseOfficialRoster(
        table("Active", 44, 0, true) + table("TRC", 30, 100),
        url,
      ),
    /incomplete/,
  );
  assert.throws(
    () =>
      parseOfficialRoster(
        table("Active", 44, 0, true) + table("Practice Squad", 16, 100),
        url,
      ),
    /incomplete/,
  );
});
test("quarterback must belong to the recognised Active group", () => {
  assert.throws(
    () =>
      parseOfficialRoster(
        table("Active", 53) + table("Practice Squad", 10, 100, true),
        url,
      ),
    /incomplete/,
  );
});
test("duplicate names/profile copies do not create a complete roster or unique match", () => {
  const repeated = table("Active", 1, 0, true);
  const duplicateRows = Array.from({ length: 50 }, () => repeated).join("");
  assert.throws(() => parseOfficialRoster(duplicateRows, url), /incomplete/);
  assert.throws(
    () =>
      parseOfficialRoster(
        table("Active", 45, 0, true) + table("Active", 1, 0, true),
        url,
      ),
    /incomplete/,
  );
  const rows = parseOfficialRoster(
    table("Active", 45, 0, true) + table("TRC", 1, 0),
    url,
  );
  assert.equal(matchKnownRoster(rows, "Fixture 0", "QB"), null);
});
test("position compatibility and original safety limits remain enforced", () => {
  const rows = parseOfficialRoster(table("Active", 53, 0, true), url);
  assert.equal(matchKnownRoster(rows, "Fixture 0", "WR"), null);
  assert.equal(matchKnownRoster(rows, "Fixture 0", "QB")?.status, "active");
  assert.throws(
    () => parseOfficialRoster(table("Active", 111, 0, true), url),
    /incomplete/,
  );
  assert.throws(
    () => parseOfficialRoster("x".repeat(5_000_001), url),
    /exceeds/,
  );
});

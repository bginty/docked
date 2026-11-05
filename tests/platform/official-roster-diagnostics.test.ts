import { test } from "node:test";
import assert from "node:assert/strict";
import type { Sql } from "postgres";
import { officialRosterDiagnostic } from "../../src/core/official-roster-diagnostics";
import { refreshOfficialRosters } from "../../src/server/official-roster-refresh";

const privateError = "secret-token https://private.example.invalid/ raw-body";
function fixture(persistError?: Error) {
  let writes = 0;
  const tags = async (strings: TemplateStringsArray) => {
    if (strings.join("").includes("refresh_candidates"))
      return [
        {
          team: "ARI",
          name: "Fixture 0",
          fantasy_position: "QB",
          position: "QB",
          player_id: "fixture-player",
          provider_id: "fixture-provider",
        },
      ];
    writes++;
    if (persistError) throw persistError;
    return [];
  };
  return {
    sql: Object.assign(tags, { json: (v: unknown) => v }) as unknown as Sql,
    writes: () => writes,
  };
}
const validRoster = `<h2>Active</h2><table><thead><tr><th>Player</th><th>Pos</th><th>No</th></tr></thead><tbody>${Array.from({ length: 45 }, (_, i) => `<tr><td><a href="/team/players-roster/fixture-${i}/">Fixture ${i}</a></td><td>${i === 0 ? "QB" : "WR"}</td><td>${i}</td></tr>`).join("")}</tbody></table>`;
const respond = (response: Response) => (async () => response) as typeof fetch;

test("observer records HTTP stage/status without response content or persistence", async () => {
  const f = fixture();
  const result = await refreshOfficialRosters(
    f.sql,
    respond(new Response(privateError, { status: 403 })),
  );
  assert.deepEqual(result.teams[0], {
    team: "ARI",
    refreshed: 0,
    unresolved: 1,
    status: "unavailable; previous evidence retained",
    stage: "fetch",
    diagnostic: "SOURCE_HTTP_403",
  });
  assert.equal(f.writes(), 0);
  assert.equal(result.status, "partial");
  assert.ok(!JSON.stringify(result).includes(privateError));
});
test("observer distinguishes rejected parser evidence from HTTP availability", async () => {
  const f = fixture();
  const result = await refreshOfficialRosters(
    f.sql,
    respond(new Response("<h2>Incomplete fixture</h2>")),
  );
  assert.equal(result.teams[0].stage, "parse");
  assert.equal(result.teams[0].diagnostic, "ROSTER_INCOMPLETE");
  assert.equal(f.writes(), 0);
});
test("observer distinguishes persisted-batch rejection and retains prior evidence", async () => {
  const f = fixture(Object.assign(new Error(privateError), { code: "P0001" }));
  const result = await refreshOfficialRosters(
    f.sql,
    respond(new Response(validRoster)),
  );
  assert.equal(result.teams[0].stage, "persist");
  assert.equal(result.teams[0].diagnostic, "OBSERVATION_VALIDATION_REJECTED");
  assert.equal(result.teams[0].refreshed, 0);
  assert.equal(f.writes(), 1);
  assert.ok(!JSON.stringify(result).includes(privateError));
});
test("successful known-player observation keeps existing status and matching behavior", async () => {
  const f = fixture();
  const result = await refreshOfficialRosters(
    f.sql,
    respond(new Response(validRoster)),
  );
  assert.deepEqual(result, {
    status: "refreshed",
    teams: [{ team: "ARI", refreshed: 1, unresolved: 0, status: "checked" }],
  });
  assert.equal(f.writes(), 1);
});
test("diagnostic classifications bound timeout, redirect, oversized and database errors", () => {
  assert.equal(
    officialRosterDiagnostic(
      new DOMException(privateError, "TimeoutError"),
      "fetch",
    ),
    "SOURCE_TIMEOUT",
  );
  assert.equal(
    officialRosterDiagnostic(
      new TypeError(privateError, { cause: new Error("unexpected redirect") }),
      "fetch",
    ),
    "SOURCE_REDIRECT_REJECTED",
  );
  assert.equal(
    officialRosterDiagnostic(
      new Error("Roster response exceeds limit"),
      "parse",
    ),
    "ROSTER_SIZE_LIMIT",
  );
  assert.equal(
    officialRosterDiagnostic(
      Object.assign(new Error(privateError), { code: "42501" }),
      "persist",
    ),
    "DATABASE_PERMISSION_DENIED",
  );
  assert.equal(
    officialRosterDiagnostic(
      Object.assign(new Error(privateError), { code: "40001" }),
      "persist",
    ),
    "OBSERVATION_RETRY_REQUIRED",
  );
  assert.equal(
    officialRosterDiagnostic(
      Object.assign(new Error(privateError), { code: 123 }),
      "persist",
    ),
    "OBSERVATION_WRITE_UNAVAILABLE",
  );
  for (const stage of ["fetch", "parse", "persist"] as const)
    assert.ok(
      !officialRosterDiagnostic(new Error(privateError), stage).includes(
        privateError,
      ),
    );
});

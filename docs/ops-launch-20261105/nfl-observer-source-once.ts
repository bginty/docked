/** Owner-authorised bounded diagnosis: exactly one GET per named official team,
 * no credentials, redirects, source bypass, database, refresh or issuance. */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import {
  officialUrl,
  parseOfficialRoster,
  matchKnownRoster,
} from "../../src/core/official-roster-refresh";
import {
  officialRosterDiagnostic,
  type OfficialRosterStage,
} from "../../src/core/official-roster-diagnostics";

assert.equal(process.argv[2], "--one-request-per-team");
const privateDir = "private-data/nfl-observer-source-once-20261106";
const checkpoint = `${privateDir}/requests.private.json`;
assert.equal(
  existsSync(checkpoint),
  false,
  "One-shot source retrieval already started; do not repeat",
);
mkdirSync(privateDir, { recursive: true });
const oldEvidence = JSON.parse(
  readFileSync(
    "docs/ops-launch-20261105/nfl-pool-omissions/readback.json",
    "utf8",
  ),
);
const rows: Record<string, unknown>[] = [];
writeFileSync(
  checkpoint,
  JSON.stringify({ startedAt: new Date().toISOString(), rows }) + "\n",
);

async function main() {
  for (const team of ["ARI", "MIA", "TEN"]) {
    const row: Record<string, unknown> = {
      team,
      method: "GET",
      requestStartedAt: new Date().toISOString(),
      status: "STARTED",
      sourceRequests: 1,
    };
    rows.push(row);
    writeFileSync(checkpoint, JSON.stringify({ rows }, null, 2) + "\n");
    const url = officialUrl(team);
    assert(url);
    let stage: OfficialRosterStage = "fetch";
    let httpStatus: number | undefined;
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(20000),
        redirect: "error",
        headers: { Accept: "text/html" },
      });
      row.httpStatus = httpStatus = response.status;
      if (!response.ok) {
        await response.body?.cancel();
        throw Error("Official roster unavailable");
      }
      const html = await response.text();
      row.sourceRetrievedAt = new Date().toISOString();
      row.bytes = Buffer.byteLength(html);
      row.sha256 = createHash("sha256").update(html).digest("hex");
      stage = "parse";
      // Structural counts only: no provider text, HTML, header values or URLs.
      row.structure = {
        tables: [...html.matchAll(/<table\b/gi)].length,
        rosterLinks: [...html.matchAll(/href=["'][^"']*players-roster/gi)]
          .length,
        positionHeaders: [...html.matchAll(/<th\b[^>]*>\s*Pos/gi)].length,
        activeHeadingLevels: [
          ...html.matchAll(/<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi),
        ]
          .filter((m) =>
            /^active(?:\s|$)/i.test(
              m[2]
                .replace(/<[^>]*>/g, " ")
                .replace(/\s+/g, " ")
                .trim(),
            ),
          )
          .map((m) => Number(m[1])),
      };
      const parsed = parseOfficialRoster(html, url);
      const known = oldEvidence.source.filter(
        (r: any) =>
          r.team === team &&
          r.beta_status === "active" &&
          ["QB", "RB", "WR", "TE", "K"].includes(r.beta_position),
      );
      row.parsedRows = parsed.length;
      row.knownCompatibleActive = known.filter(
        (p: any) =>
          matchKnownRoster(parsed, p.beta_name, p.beta_position)?.status ===
          "active",
      ).length;
      row.status = "PARSED_READ_ONLY";
    } catch (error) {
      row.status = "RETAINED_EVIDENCE_REQUIRED";
      row.stage = stage;
      row.diagnostic = officialRosterDiagnostic(error, stage, httpStatus);
    }
    row.finishedAt = new Date().toISOString();
    writeFileSync(checkpoint, JSON.stringify({ rows }, null, 2) + "\n");
  }
  const report = {
    at: new Date().toISOString(),
    authority:
      "parent owner-authorised one retrieval per missing official team",
    sourceRequests: rows.length,
    retries: 0,
    redirects: false,
    credentials: false,
    databaseConnections: 0,
    productionWrites: 0,
    candidateChanged: false,
    rows,
  };
  writeFileSync(
    "docs/ops-launch-20261105/nfl-pool-omissions/current-source-once.json",
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(JSON.stringify(report, null, 2));
}
main().catch((error) => {
  console.error(
    error instanceof assert.AssertionError
      ? error.message
      : "One-shot source inspection failed; do not retry without review",
  );
  process.exitCode = 1;
});

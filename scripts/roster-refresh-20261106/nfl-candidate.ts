/** Offline draft known-identity inputs from independently captured official
 * pages. Never imports a pool, approves supply, issues a card or calls a DB. */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import {
  officialUrl,
  parseOfficialRoster,
  matchKnownRoster,
  rosterName,
} from "../../src/core/official-roster-refresh";
import { officialPositionMatches } from "../../src/core/nfl-card-eligibility";
import { jerseyPresentation } from "../../src/core/card-presentation";
import {
  dormantCommercialPool,
  poolRosterCandidate,
  type PoolRosterCandidate,
} from "../../src/core/commercial-pool-plan";

const sourceDir = "private-data/roster-refresh-20261106/nfl";
const evidence = "docs/qa/roster-refresh-20261106/nfl";
const prior = JSON.parse(
  readFileSync(
    "docs/ops-launch-20261105/nfl-pool-omissions/readback.json",
    "utf8",
  ),
);
const base = JSON.parse(
  readFileSync(
    "private-data/commercial-pool-20261105/candidate.private.json",
    "utf8",
  ),
);
const baseIds = new Set(
  base.rows.map((r: { player_id: string }) => r.player_id),
);
const inputs: PoolRosterCandidate[] = [];
const teams = [];
const holds = [];
const sha = (s: string) => createHash("sha256").update(s).digest("hex");
const plain = (s: string) =>
  s
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;|&#160;/g, " ")
    .replace(/\s+/g, " ")
    .trim();

function jerseyNumbers(html: string, url: string) {
  const numbers = new Map<string, number | null>();
  for (const table of html.matchAll(/<table\b[^>]*>([\s\S]*?)<\/table>/gi)) {
    const headers = [...table[1].matchAll(/<th\b[^>]*>([\s\S]*?)<\/th>/gi)].map(
      (r) => plain(r[1]),
    );
    const numberIndex = headers.findIndex(
      (h) => h === "#" || /^(?:No\.?|Number)$/i.test(h),
    );
    if (numberIndex < 0) continue;
    for (const row of table[1].matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
      const cells = [...row[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map(
        (c) => c[1],
      );
      if (cells.length <= numberIndex) continue;
      const link = cells[0]?.match(
        /<a\b[^>]*href=["']([^"']*players-roster[^"']*)["']/i,
      );
      if (!link) continue;
      const profile = new URL(link[1], url).href;
      const value = plain(cells[numberIndex]);
      const number = /^\d{1,2}$/.test(value) ? Number(value) : null;
      numbers.set(
        profile,
        numbers.has(profile) && numbers.get(profile) !== number ? null : number,
      );
    }
  }
  return numbers;
}

for (const team of ["ARI", "MIA", "TEN"]) {
  const record = JSON.parse(readFileSync(`${sourceDir}/${team}.json`, "utf8"));
  assert.equal(record.status, "observed");
  assert.equal(record.url, officialUrl(team));
  assert.ok(Date.parse(record.fetchedAt) <= Date.now());
  assert.ok(
    Date.now() - Date.parse(record.fetchedAt) < 72 * 3600000,
    "Local source is stale; do not relabel its retrieval time",
  );
  const html = readFileSync(record.file, "utf8");
  assert.equal(sha(html), record.sha256);
  const rows = parseOfficialRoster(html, record.url);
  const numbers = jerseyNumbers(html, record.url);
  const known = prior.source.filter(
    (r: Record<string, unknown>) =>
      r.team === team && r.beta_id && r.beta_status === "active",
  );
  let accepted = 0;
  for (const old of known) {
    const permanent = old.permanent_identity;
    const name = permanent?.name ?? old.beta_name;
    const position = old.beta_position;
    const match = matchKnownRoster(rows, name, position);
    let reason = "";
    if (!permanent || rosterName(name) !== rosterName(old.beta_name))
      reason = "existing-identity-name-disagreement";
    else if (!match) reason = "current-unique-name-position-agreement-missing";
    else if (match.status !== "active")
      reason = `current-source-status-${match.status}`;
    else if (!officialPositionMatches(match.position, position))
      reason = "unsupported-position";
    else if (baseIds.has(old.beta_id)) reason = "already-in-existing-pool";
    if (reason) {
      holds.push({
        team,
        playerId: old.beta_id,
        reason,
        observedSection: match?.section ?? null,
      });
      continue;
    }
    const input = poolRosterCandidate.parse({
      id: old.beta_id,
      sport: "nfl",
      provider: "nflverse",
      providerId: old.provider_id,
      eligiblePositions: [position],
      snapshot: {
        name: old.beta_name,
        team,
        position,
        season: "2026",
        verifiedJerseyNumber: numbers.get(match!.profile) ?? null,
        colour: jerseyPresentation({ sport: "nfl", team }).primary,
        status: "active",
        synthetic: false,
      },
      source: {
        url: record.url,
        hash: record.sha256,
        checkedAt: record.fetchedAt,
        license: "factual-roster-observation; owner-confirmed-name-use",
        verification:
          "existing-stable-provider-identity-and-current-unique-official-name-position-agreement",
        permanentIssuanceEligible: false,
      },
    });
    inputs.push(input);
    accepted++;
  }
  teams.push({
    team,
    httpStatus: record.httpStatus,
    fetchedAt: record.fetchedAt,
    sourceHash: record.sha256,
    parsedRows: rows.length,
    recognisedActive: rows.filter((r) => r.status === "active").length,
    unknown: rows
      .filter((r) => r.status === "unknown")
      .map((r) => ({
        section: r.section,
        position: r.position,
        eligible: false,
      })),
    knownActiveCandidates: known.length,
    acceptedExistingIdentities: accepted,
    declaredSourceSeason: null,
    sourceContext:
      "Current official roster observed on the recorded date; page has no explicit roster-season declaration. Existing catalogue season2026 is preserved separately, not claimed as a page declaration.",
  });
}
inputs.sort((a, b) => a.id.localeCompare(b.id));
const definitions = dormantCommercialPool(inputs);
assert.equal(new Set(inputs.map((r) => r.id)).size, inputs.length);
assert.ok(
  definitions.every(
    (r) => !r.approved && r.issued === 0 && r.legacy_issued === 0,
  ),
);
assert.ok(inputs.every((r) => !baseIds.has(r.id)));
const inputText = JSON.stringify(inputs, null, 2) + "\n";
mkdirSync(evidence, { recursive: true });
writeFileSync(`${sourceDir}/pool-inputs.private.json`, inputText);
const report = {
  at: new Date().toISOString(),
  status: "LOCAL_DRAFT_CURRENT_SOURCE_INPUTS_ONLY",
  productionWrites: 0,
  approvals: 0,
  inventoryIssued: 0,
  sourceRequests: 0,
  existingPlayerIdsOnly: true,
  newPlayerIds: 0,
  accepted: inputs.length,
  draftDefinitions: definitions.length,
  inputsSha256: sha(inputText),
  teams,
  holds,
  baseCandidateUnchanged: true,
  sourceSeasonDisclosure:
    "Observed calendar2026 and existing catalogue season2026; no explicit official roster-season declaration inferred from copyright/footer dates.",
  output: "private-data/roster-refresh-20261106/nfl/pool-inputs.private.json",
};
writeFileSync(
  `${evidence}/candidate-manifest.json`,
  JSON.stringify(report, null, 2) + "\n",
);
console.log(JSON.stringify(report, null, 2));

/** Build a private, unapproved PoolRosterCandidate input from the dated evidence. */
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { createHash } from "node:crypto";
import {
  poolRosterCandidate,
  type PoolRosterCandidate,
} from "../../src/core/commercial-pool-plan";
import { teamColours } from "../../src/core/sport-team-colours";
const root = "private-data/roster-refresh-20261106/wikimedia",
  out = "docs/qa/roster-refresh-20261106/wikimedia";
const published =
  "public/data/rosters/wikimedia-roster-beta-2026-10-23-v1.json";
const sha = (x: string | Buffer) =>
  createHash("sha256").update(x).digest("hex");
const raw = await fs.readFile(published),
  before = JSON.parse(raw.toString()),
  review = JSON.parse(await fs.readFile(root + "/review.json", "utf8"));
assert.equal(sha(raw), review.baseSnapshotSha256);
assert.equal(review.permanentIssuanceApproved, false);
assert.equal(review.newIdsCreated, 0);
type Sport = "afl" | "nrl";
type Old = {
  sport: Sport;
  fixturePlayerId: string;
  providerId: string;
  position: string;
  rosterBeta: { wikidataId: string };
};
type Row = {
  sport: Sport;
  name: string;
  team: string;
  wikidataId: string;
  existingId: string;
  sourceSeason: string;
  rootDeclaredSeason: string | null;
  teamDeclaredSeason: string | null;
  rosterTemplate: string;
  rosterTemplateRevision: number;
  rosterTemplateSha256: string;
  rosterRootRevision: number;
  rosterExpandedSha256: string;
  rosterObservedAt: string;
  teamObservedAt: string;
  profileRevision: number;
  profileRevisionTimestamp: string;
  profileObservedAt: string;
  profileSha256: string;
  profileSource: string;
  positions: string[];
  rosterJerseyNumber: string | null;
  profileJerseyNumber: number | null;
};
const known = new Map(
  (before.players as Old[])
    .filter((p) => p.sport === "afl" || p.sport === "nrl")
    .map((p) => [p.sport + ":" + p.rosterBeta.wikidataId, p]),
);
assert.equal(known.size, 882);
const now = Date.now();
const evidence: Row[] = review.accepted;
const candidates: PoolRosterCandidate[] = evidence
  .map((r) => {
    const old = known.get(r.sport + ":" + r.wikidataId);
    assert(old);
    assert.equal(old.fixturePlayerId, r.existingId);
    assert.equal(r.sourceSeason, "2026");
    assert(r.teamDeclaredSeason === null || r.teamDeclaredSeason === "2026");
    assert(r.rootDeclaredSeason === "2026");
    for (const t of [r.rosterObservedAt, r.teamObservedAt, r.profileObservedAt])
      assert(now - Date.parse(t) >= 0 && now - Date.parse(t) < 72 * 3600000);
    assert(Date.parse(r.profileObservedAt) >= Date.parse(r.teamObservedAt));
    const colour = teamColours(r.sport, r.team);
    assert(colour);
    const number =
      r.sport === "afl" &&
      r.rosterJerseyNumber !== null &&
      /^\d{1,2}$/.test(r.rosterJerseyNumber) &&
      Number(r.rosterJerseyNumber) === r.profileJerseyNumber
        ? r.profileJerseyNumber
        : null;
    const sourceHash = sha(
      JSON.stringify({
        rosterExpandedSha256: r.rosterExpandedSha256,
        rosterTemplateRevision: r.rosterTemplateRevision,
        rosterTemplateSha256: r.rosterTemplateSha256,
        profileRevision: r.profileRevision,
        profileSha256: r.profileSha256,
        sourceSeason: r.sourceSeason,
        teamDeclaredSeason: r.teamDeclaredSeason,
      }),
    );
    return poolRosterCandidate.parse({
      id: old.fixturePlayerId,
      sport: r.sport,
      provider: "wikimedia",
      providerId: old.providerId,
      snapshot: {
        name: r.name,
        team: r.team,
        position: r.positions.includes(old.position)
          ? old.position
          : r.positions[0],
        season: "2026",
        verifiedJerseyNumber: number,
        colour: colour.primary,
        accentColour: colour.accent,
        status: "active",
        synthetic: false,
      },
      eligiblePositions: r.positions,
      source: {
        url: r.profileSource,
        hash: sourceHash,
        checkedAt: r.profileObservedAt,
        license: "CC-BY-SA-4.0",
        verification:
          "fresh-wikimedia-team-template-expanded-roster-and-profile-agreement; " +
          (r.teamDeclaredSeason
            ? "explicit-team-season-2026"
            : "root-declared-season-2026; team-personnel-season-unspecified; future-transfer-guards-applied"),
        permanentIssuanceEligible: false,
      },
    });
  })
  .sort((a, b) => `${a.sport}:${a.id}`.localeCompare(`${b.sport}:${b.id}`));
assert.equal(new Set(candidates.map((r) => r.id)).size, candidates.length);
assert(
  candidates.every(
    (r) =>
      r.source.permanentIssuanceEligible === false &&
      new URL(r.source.url).hostname === "en.wikipedia.org",
  ),
);
assert(
  candidates
    .filter((r) => r.sport === "nrl")
    .every((r) => r.snapshot.verifiedJerseyNumber === null),
);
assert.equal(sha(await fs.readFile(published)), review.baseSnapshotSha256);
const payload = JSON.stringify(candidates, null, 2) + "\n";
await fs.writeFile(root + "/pool-roster-inputs.json", payload, { mode: 0o600 });
const refs = [
  "root-observations.json",
  "team-template-request.json",
  "team-source-seasons.json",
  "profile-requests.json",
  "discovery-summary.json",
  "review-summary.json",
];
const hashes = Object.fromEntries(
  await Promise.all(
    refs.map(async (f) => [f, sha(await fs.readFile(out + "/" + f))]),
  ),
);
const teams = JSON.parse(
  await fs.readFile(out + "/team-source-seasons.json", "utf8"),
) as {
  sport: Sport;
  team: string;
  sourceSeason: string;
  teamDeclaredSeason: string | null;
  template: string;
  revision: number;
}[];
const sourceSummary = JSON.parse(
  await fs.readFile(out + "/review-summary.json", "utf8"),
);
const bySport = Object.fromEntries(
  (["afl", "nrl"] as const).map((s) => {
    const rows = candidates.filter((r) => r.sport === s);
    return [
      s,
      {
        accepted: rows.length,
        teams: [...new Set(rows.map((r) => r.snapshot.team))].sort(),
        verifiedNumbers: rows.filter(
          (r) => r.snapshot.verifiedJerseyNumber !== null,
        ).length,
        positions: Object.fromEntries(
          [...new Set(rows.flatMap((r) => r.eligiblePositions))]
            .sort()
            .map((p) => [
              p,
              rows.filter((r) => r.eligiblePositions.includes(p)).length,
            ]),
        ),
      },
    ];
  }),
);
const manifest = {
  at: new Date().toISOString(),
  snapshot: "wikimedia-afl-nrl-factual-2026-11-06-v1",
  inputFile: root + "/pool-roster-inputs.json",
  inputsSha256: sha(payload),
  accepted: candidates.length,
  acceptedBySport: bySport,
  productionWrites: 0,
  newUuids: 0,
  permanentIssuanceApproved: false,
  publishedDatasetUnchanged: true,
  basePublishedDataset: { file: published, sha256: review.baseSnapshotSha256 },
  sourceSeasonScope:
    "2026; AFL root explicitly declares2026, current team personnel templates lack independent season labels; changed-team/future profile evidence held unless explicit2026 career coverage. NRL only exact2026 team templates;2027 contexts held.",
  futureTeamTemplatesHeld: teams.filter((t) => t.teamDeclaredSeason === "2027"),
  held: sourceSummary.held,
  holdsByReason: sourceSummary.holdsByReason,
  futureTemplateRowsHeld: sourceSummary.futureTemplateRowsHeld,
  rawReviewPrivate: root + "/review.json",
  rawReviewSha256: sha(await fs.readFile(root + "/review.json")),
  sourceEvidenceSha256: hashes,
  attribution: {
    text: "Wikipedia contributors; per-record profile oldid and separate team template revision links/hashes are retained in the dated evidence.",
    rosterTextLicense: "CC-BY-SA-4.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
    identifierLicense: "CC0 (Wikidata identifiers)",
    changes:
      "Extracted factual roster/name/position associations, held conflicts and future seasons, reused existing Docked IDs, normalised known team/position labels and kept numberless fallbacks.",
    termsUrl:
      "https://foundation.wikimedia.org/wiki/Policy:Terms_of_Use/en#7._Licensing_of_Content",
    apiEtiquetteUrl: "https://www.mediawiki.org/wiki/API:Etiquette",
  },
  scope:
    "Local factual preparation only. No stats, images, likenesses, logos, sponsors, supplier commercial rights, contract/health verification or independent issuance approval are asserted. No NBA requests, new team, public data overwrite, deployment, permanent issue or pool import.",
  validatedSchema: true,
  passed: true,
};
await fs.writeFile(
  out + "/input-manifest.json",
  JSON.stringify(manifest, null, 2) + "\n",
);
console.log(
  JSON.stringify({
    accepted: manifest.accepted,
    bySport: Object.fromEntries(
      Object.entries(bySport).map(([s, v]) => [
        s,
        { accepted: v.accepted, teams: v.teams.length },
      ]),
    ),
    inputsSha256: manifest.inputsSha256,
    futureTeamTemplates: manifest.futureTeamTemplatesHeld.map((t) => t.team),
    productionWrites: 0,
    newUuids: 0,
  }),
);

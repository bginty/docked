/** Independent, dated three-team 2026 NRL supplement. Original AU inputs untouched. */
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { createHash } from "node:crypto";
import {
  poolRosterCandidate,
  type PoolRosterCandidate,
} from "../../src/core/commercial-pool-plan";
import { teamColours } from "../../src/core/sport-team-colours";
const root = "private-data/roster-refresh-20261106/wikimedia",
  out = "docs/qa/roster-refresh-20261106/wikimedia",
  dir = root + "/supplement",
  sha = (b: string | Buffer) => createHash("sha256").update(b).digest("hex");
const originalManifest = await fs.readFile(out + "/input-manifest.json"),
  original = JSON.parse(originalManifest.toString()),
  base = await fs.readFile(root + "/pool-roster-inputs.json");
assert.equal(sha(base), original.inputsSha256);
assert.equal(original.accepted, 816);
const baseRows = JSON.parse(base.toString()) as PoolRosterCandidate[];
const old = JSON.parse(
  await fs.readFile(
    "public/data/rosters/wikimedia-roster-beta-2026-10-23-v1.json",
    "utf8",
  ),
);
const known = new Map<
  string,
  { fixturePlayerId: string; providerId: string; position: string }
>(
  old.players
    .filter((p: { sport: string }) => p.sport === "nrl")
    .map(
      (p: {
        fixturePlayerId: string;
        providerId: string;
        position: string;
        rosterBeta: { wikidataId: string };
      }) => [p.rosterBeta.wikidataId, p],
    ),
);
const review = JSON.parse(await fs.readFile(dir + "/review.json", "utf8"));
const obs = JSON.parse(
  await fs.readFile(out + "/supplement-observations.json", "utf8"),
) as {
  team: string;
  page: string;
  revision: number;
  observedAt: string;
  expandedHtmlSha256: string;
  sourceUrl: string;
}[];
type Row = {
  sport: "nrl";
  sourceContext: string;
  name: string;
  team: string;
  wikidataId: string;
  existingId: string;
  sourceSeason: string;
  teamDeclaredSeason: string;
  rosterTemplate: string;
  rosterTemplateRevision: number;
  rosterExpandedSha256: string;
  rosterObservedAt: string;
  profileRevision: number;
  profileObservedAt: string;
  profileSha256: string;
  profileSource: string;
  positions: string[];
};
const rows = (review.accepted as Row[])
  .map((r) => {
    assert.equal(r.sport, "nrl");
    assert.equal(r.sourceSeason, "2026");
    assert.equal(r.teamDeclaredSeason, "2026");
    assert.equal(r.sourceContext, "explicit-2026-season-article-squad");
    const k = known.get(r.wikidataId);
    assert(k);
    assert.equal(r.existingId, k.fixturePlayerId);
    assert(
      !baseRows.some((x) => x.id === k.fixturePlayerId),
      "Supplement cannot replace original accepted identity",
    );
    const source = obs.find((x) => x.team === r.team);
    assert(source);
    assert.equal(source.revision, r.rosterTemplateRevision);
    assert.equal(source.expandedHtmlSha256, r.rosterExpandedSha256);
    for (const t of [r.rosterObservedAt, r.profileObservedAt])
      assert(
        Date.now() - Date.parse(t) >= 0 &&
          Date.now() - Date.parse(t) < 72 * 3600000,
      );
    assert(
      r.positions.every((p) => ["WFB", "CTR", "HLF", "EDG", "MID"].includes(p)),
    );
    const c = teamColours("nrl", r.team);
    assert(c);
    const url =
      "https://en.wikipedia.org/w/index.php?title=" +
      encodeURIComponent(source.page.replaceAll(" ", "_")) +
      "&oldid=" +
      source.revision;
    return poolRosterCandidate.parse({
      id: k.fixturePlayerId,
      sport: "nrl",
      provider: "wikimedia",
      providerId: k.providerId,
      snapshot: {
        name: r.name,
        team: r.team,
        position: r.positions.includes(k.position)
          ? k.position
          : r.positions[0],
        season: "2026",
        verifiedJerseyNumber: null,
        colour: c.primary,
        accentColour: c.accent,
        status: "active",
        synthetic: false,
      },
      eligiblePositions: r.positions,
      source: {
        url,
        hash: sha(
          JSON.stringify({
            sectionRevision: source.revision,
            sectionExpandedHtmlSha256: source.expandedHtmlSha256,
            profileRevision: r.profileRevision,
            profileSha256: r.profileSha256,
            sourceContext: r.sourceContext,
            season: "2026",
          }),
        ),
        checkedAt: r.rosterObservedAt,
        license: "CC-BY-SA-4.0",
        verification:
          "fresh-explicit-2026-season-article-squad-and-supported-position; same-dated-cached-current-profile-club-and-position-agreement; no-2027-context-relabel",
        permanentIssuanceEligible: false,
      },
    });
  })
  .sort((a, b) => a.id.localeCompare(b.id));
assert.equal(new Set(rows.map((r) => r.id)).size, rows.length);
assert.equal(new Set(rows.map((r) => r.snapshot.team)).size, 3);
const payload = JSON.stringify(rows, null, 2) + "\n";
const file = dir + "/pool-roster-inputs.json";
await fs.writeFile(file, payload, { mode: 0o600, flag: "wx" });
const summary = JSON.parse(
  await fs.readFile(out + "/supplement-review-summary.json", "utf8"),
);
const manifest = {
  at: new Date().toISOString(),
  snapshot: "wikimedia-nrl-2026-squad-supplement-2026-11-06-v1",
  inputFile: file,
  inputsSha256: sha(payload),
  accepted: rows.length,
  acceptedByTeam: Object.fromEntries(
    obs.map((o) => [
      o.team,
      rows.filter((r) => r.snapshot.team === o.team).length,
    ]),
  ),
  productionWrites: 0,
  newUuids: 0,
  permanentIssuanceApproved: false,
  sourceContext:
    "2026 season-specific squad sections, freshly observed. Current profile club and supported position corroborated from the already complete same-dated observation cache. Not a 2027 roster or active match/contract/statistics claim.",
  observations: obs,
  priorAu: {
    inputsSha256: original.inputsSha256,
    manifestSha256: sha(originalManifest),
    accepted: original.accepted,
    unchanged: true,
  },
  profileCrawlRepeated: false,
  officialNrlSiteUsedForCandidate: false,
  held: summary.held,
  holdsByReason: summary.holdsByReason,
  privateReview: dir + "/review.json",
  privateReviewSha256: sha(await fs.readFile(dir + "/review.json")),
  attribution: original.attribution,
  validatedSchema: true,
  passed: true,
};
assert.equal(
  sha(await fs.readFile(root + "/pool-roster-inputs.json")),
  original.inputsSha256,
);
assert.equal(
  sha(await fs.readFile(out + "/input-manifest.json")),
  manifest.priorAu.manifestSha256,
);
await fs.writeFile(
  out + "/supplement-input-manifest.json",
  JSON.stringify(manifest, null, 2) + "\n",
  { flag: "wx" },
);
console.log(
  JSON.stringify({
    accepted: manifest.accepted,
    acceptedByTeam: manifest.acceptedByTeam,
    inputsSha256: manifest.inputsSha256,
    originalAuUnchanged: true,
    newUuids: 0,
    productionWrites: 0,
  }),
);

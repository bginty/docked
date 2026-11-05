/** Verify and fold reviewed dated inputs without rewriting either source packet. */
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
  sha = (b: string | Buffer) => createHash("sha256").update(b).digest("hex"),
  combined = root + "/combined-v2";
const descriptors = [
  {
    name: "current-rosters",
    manifest: out + "/input-manifest.json",
    review: root + "/review.json",
    accepted: 816,
  },
  {
    name: "three-2026-squad-sections",
    manifest: out + "/supplement-input-manifest.json",
    review: root + "/supplement/review.json",
    accepted: 51,
  },
];
const published = await fs.readFile(
  "public/data/rosters/wikimedia-roster-beta-2026-10-23-v1.json",
);
const old = JSON.parse(published.toString());
const known = new Map<string, string>(
  old.players
    .filter((p: { sport: string }) => ["afl", "nrl"].includes(p.sport))
    .map(
      (p: { sport: string; providerId: string; fixturePlayerId: string }) => [
        p.sport + ":" + p.providerId,
        p.fixturePlayerId,
      ],
    ),
);
const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/football club/g, "")
    .replace(/fc/g, "")
    .replace(/[^a-z0-9]/g, "");
const aliases: Record<string, string> = {
  "The Dolphins": "Dolphins",
  "Manly Sea Eagles": "Manly-Warringah Sea Eagles",
  "North Qld Cowboys": "North Queensland Cowboys",
  "Nth Qld Cowboys": "North Queensland Cowboys",
  "South Sydney": "South Sydney Rabbitohs",
  "St. George Illawarra": "St. George Illawarra Dragons",
  "Canterbury Bulldogs": "Canterbury-Bankstown Bulldogs",
  "Cronulla Sharks": "Cronulla-Sutherland Sharks",
  "Greater Western Sydney Giants": "Greater Western Sydney",
};
const rows: PoolRosterCandidate[] = [],
  packets = [];
const ids = new Set<string>(),
  providers = new Set<string>();
for (const descriptor of descriptors) {
  const manifestBytes = await fs.readFile(descriptor.manifest),
    manifest = JSON.parse(manifestBytes.toString());
  assert.equal(manifest.accepted, descriptor.accepted);
  assert.equal(manifest.productionWrites, 0);
  assert.equal(manifest.newUuids, 0);
  assert.equal(manifest.permanentIssuanceApproved, false);
  const input = await fs.readFile(manifest.inputFile);
  assert.equal(sha(input), manifest.inputsSha256);
  const reviewBytes = await fs.readFile(descriptor.review);
  assert.equal(
    sha(reviewBytes),
    manifest.rawReviewSha256 ?? manifest.privateReviewSha256,
  );
  const review = JSON.parse(reviewBytes.toString());
  const evidence = new Map<string, Record<string, unknown>>(
    review.accepted.map((r: { existingId: string }) => [r.existingId, r]),
  );
  assert.equal(evidence.size, descriptor.accepted);
  for (const candidate of (JSON.parse(input.toString()) as unknown[]).map((x) =>
    poolRosterCandidate.parse(x),
  )) {
    const r = evidence.get(candidate.id);
    assert(r);
    assert.equal(
      known.get(candidate.sport + ":" + candidate.providerId),
      candidate.id,
    );
    assert.equal(candidate.providerId, candidate.sport + ":" + r.wikidataId);
    assert(!ids.has(candidate.id));
    assert(!providers.has(candidate.sport + ":" + candidate.providerId));
    ids.add(candidate.id);
    providers.add(candidate.sport + ":" + candidate.providerId);
    assert.equal(candidate.sport, r.sport);
    assert.equal(candidate.snapshot.team, r.team);
    assert.equal(candidate.snapshot.season, "2026");
    assert.equal(r.sourceSeason, "2026");
    assert.equal(r.rootDeclaredSeason, "2026");
    assert(r.teamDeclaredSeason === null || r.teamDeclaredSeason === "2026");
    assert.equal(candidate.source.license, "CC-BY-SA-4.0");
    assert.equal(candidate.source.permanentIssuanceEligible, false);
    assert.deepEqual(candidate.eligiblePositions, r.positions);
    assert(candidate.eligiblePositions.includes(candidate.snapshot.position));
    const club = String(r.profileClub),
      left = teamColours(candidate.sport, aliases[club] ?? club)?.id,
      right = teamColours(candidate.sport, candidate.snapshot.team)?.id;
    assert(right);
    assert(
      left === right ||
        norm(aliases[club] ?? club) === norm(candidate.snapshot.team),
      "Current profile club mismatch: " +
        club +
        " / " +
        candidate.snapshot.team,
    );
    assert.equal((r.futureClubYears as string[]).length, 0);
    const url = new URL(candidate.source.url);
    assert.equal(url.hostname, "en.wikipedia.org");
    const supplement = descriptor.name !== "current-rosters";
    assert.equal(
      url.searchParams.get("oldid"),
      String(supplement ? r.rosterTemplateRevision : r.profileRevision),
    );
    assert.equal(
      candidate.source.checkedAt,
      supplement ? r.rosterObservedAt : r.profileObservedAt,
    );
    for (const value of [r.rosterObservedAt, r.profileObservedAt]) {
      const age = Date.now() - Date.parse(String(value));
      assert(age >= 0 && age < 72 * 3600000);
    }
    const expectedHash = supplement
      ? sha(
          JSON.stringify({
            sectionRevision: r.rosterTemplateRevision,
            sectionExpandedHtmlSha256: r.rosterExpandedSha256,
            profileRevision: r.profileRevision,
            profileSha256: r.profileSha256,
            sourceContext: r.sourceContext,
            season: "2026",
          }),
        )
      : sha(
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
    assert.equal(candidate.source.hash, expectedHash);
    if (candidate.sport === "nrl")
      assert.equal(candidate.snapshot.verifiedJerseyNumber, null);
    rows.push(candidate);
  }
  packets.push({
    name: descriptor.name,
    manifest: descriptor.manifest,
    manifestSha256: sha(manifestBytes),
    input: manifest.inputFile,
    inputsSha256: manifest.inputsSha256,
    accepted: descriptor.accepted,
    review: descriptor.review,
    reviewSha256: sha(reviewBytes),
    heldSourceRows: review.held.length,
    heldBySport: manifest.held,
    holdsByReason: manifest.holdsByReason,
    actualSourceContext: manifest.sourceSeasonScope ?? manifest.sourceContext,
  });
}
rows.sort((a, b) => `${a.sport}:${a.id}`.localeCompare(`${b.sport}:${b.id}`));
assert.equal(rows.length, 867);
const af = rows.filter((x) => x.sport === "afl"),
  nr = rows.filter((x) => x.sport === "nrl");
assert.equal(af.length, 537);
assert.equal(nr.length, 330);
assert.equal(new Set(af.map((x) => x.snapshot.team)).size, 18);
assert.equal(new Set(nr.map((x) => x.snapshot.team)).size, 17);
assert.equal(
  sha(published),
  JSON.parse(await fs.readFile(descriptors[0].manifest, "utf8"))
    .basePublishedDataset.sha256,
);
const payload = JSON.stringify(rows, null, 2) + "\n",
  inputFile = combined + "/pool-roster-inputs.json";
await fs.mkdir(combined, { recursive: true });
await fs.writeFile(inputFile, payload, { mode: 0o600, flag: "wx" });
for (const p of packets) {
  assert.equal(sha(await fs.readFile(p.manifest)), p.manifestSha256);
  assert.equal(sha(await fs.readFile(p.input)), p.inputsSha256);
  assert.equal(sha(await fs.readFile(p.review)), p.reviewSha256);
}
const first = JSON.parse(await fs.readFile(descriptors[0].manifest, "utf8"));
const manifest = {
  at: new Date().toISOString(),
  snapshot: "wikimedia-afl-nrl-factual-2026-11-06-v2",
  inputFile,
  inputsSha256: sha(payload),
  accepted: rows.length,
  acceptedBySport: {
    afl: { accepted: af.length, teams: 18 },
    nrl: { accepted: nr.length, teams: 17 },
  },
  productionWrites: 0,
  newUuids: 0,
  permanentIssuanceApproved: false,
  originalPacketsUnchanged: true,
  sourcePackets: packets,
  sourceEvidence: [
    out + "/root-observations.json",
    out + "/team-source-seasons.json",
    out + "/profile-requests.json",
    out + "/supplement-observations.json",
  ],
  holdsScope:
    "All original 2027 template rows remain held in their original source context. Additional explicit 2026 season sections corroborate 51 existing players with same-dated current profiles. Hold counts describe source rows and can overlap identities or reasons; not all omitted players are ineligible or retired.",
  attribution: first.attribution,
  identifierLicenseUrl: "https://www.wikidata.org/wiki/Wikidata:Licensing",
  validatedSchema: true,
  validatedOriginalDigests: true,
  validatedExactSourceSeasonAndRevisions: true,
  validatedCurrentProfileClubAndPositionAgreement: true,
  validatedUniqueIdsAndProviderAliases: true,
  passed: true,
};
const output = out + "/combined-input-manifest-20261106-v2.json";
await fs.writeFile(output, JSON.stringify(manifest, null, 2) + "\n", {
  flag: "wx",
});
console.log(
  JSON.stringify({
    inputFile,
    manifest: output,
    inputsSha256: manifest.inputsSha256,
    accepted: manifest.accepted,
    bySport: manifest.acceptedBySport,
    originalPacketsUnchanged: true,
  }),
);

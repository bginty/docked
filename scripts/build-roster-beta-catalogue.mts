/** Offline packaging of reviewed, cached Wikimedia facts; never calls a database. */
import fs from "node:fs/promises";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import { fixtureSports, type FixtureSport } from "../src/core/fixture-sports";
import { isRosterBetaPlayer } from "../src/core/roster-beta";
import type { EconomyPlayer } from "../src/core/card-economy";
const input = "private-data/roster-source-review";
const review = JSON.parse(await fs.readFile(input + "/review.json", "utf8"));
const hash = (x: unknown) =>
  createHash("sha256").update(JSON.stringify(x)).digest("hex");
export function rosterUuid(key: string) {
  const h = createHash("sha256").update(key).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
}
const sourceFiles = (await fs.readdir(input)).filter((f) =>
  /^(nba-east-response.txt|nbaWest.json|afl.json|nrl.json|nrl-history-.*.json)$/.test(
    f,
  ),
);
const sources = [];
for (const file of sourceFiles) {
  const raw = await fs.readFile(input + "/" + file, "utf8");
  const d = JSON.parse(raw);
  const p = d.parse ?? d.query.pages[0];
  sources.push({
    file,
    title: p.title,
    revision: p.revid ?? p.revisions[0].revid,
    sha256: createHash("sha256").update(raw).digest("hex"),
  });
}
const observed = new Map<number, string>();
for (const file of await fs.readdir(input + "/profiles")) {
  const d = JSON.parse(await fs.readFile(input + "/profiles/" + file, "utf8"));
  for (const p of d.query.pages)
    if (p.revisions) observed.set(p.revisions[0].revid, d.docked.fetchedAt);
}
const catalogue = "wikimedia-roster-beta-2026-10-23-v1";
type ReviewedPlayer = {
  sport: FixtureSport;
  name: string;
  team: string;
  wikidataId: string;
  rosterSource: string;
  profileSource: string;
  profileRevision: number;
  profileHash: string;
  positions: string[];
};
const players: EconomyPlayer[] = review.players.map((p: ReviewedPlayer) => {
  const sport = p.sport as FixtureSport;
  assert(fixtureSports[sport]);
  const source = sources.find((s) =>
    decodeURIComponent(p.rosterSource).endsWith(s.title.replaceAll(" ", "_")),
  );
  assert(source, "Roster source provenance required: " + p.rosterSource);
  const verifiedAt = observed.get(p.profileRevision);
  assert(verifiedAt && Date.parse(verifiedAt) <= Date.now());
  const canonicalPlayerId = rosterUuid(
    `docked:player:${sport}:wikidata:${p.wikidataId}`,
  );
  const value: EconomyPlayer = {
    id: `${fixtureSports[sport].prefix}-roster-beta-${p.wikidataId}`,
    sport,
    inventoryClass: "real-roster-beta-v1",
    synthetic: false,
    provider: "wikimedia",
    providerId: `${sport}:${p.wikidataId}`,
    fixturePlayerId: canonicalPlayerId,
    assetKind: "player",
    name: p.name,
    position: p.positions[0],
    eligiblePositions: p.positions,
    currentTeam: p.team,
    status: "active",
    observedAt: Date.parse(verifiedAt),
    sourceRevision: String(p.profileRevision),
    presentation: `docked-${sport}-v1`,
    verifiedJerseyNumber: null,
    rosterBeta: {
      catalogue,
      canonicalPlayerId,
      wikidataId: p.wikidataId,
      rosterSource: p.rosterSource + `?oldid=${source.revision}`,
      profileSource: p.profileSource,
      verifiedAt,
      sourceHash: hash({ profile: p.profileHash, roster: source.sha256 }),
      license: "CC-BY-SA-4.0",
      verification: "roster-and-profile-agreement",
      permanentIssuanceEligible: false,
    },
  };
  assert(isRosterBetaPlayer(value));
  return value;
});
assert.equal(new Set(players.map((p) => p.id)).size, players.length);
const document = {
  catalogue,
  license: "CC-BY-SA-4.0",
  licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
  attribution:
    "Wikipedia contributors. Source links and revisions accompany each record.",
  changes:
    "Selected roster facts; normalised club aliases and Docked beta positions; assigned stable Wikidata-based identities. No images, biographies or statistics copied.",
  scope:
    "Source-verified roster snapshot for non-permanent private beta inventory. Roster membership is not independent contract verification or commercial player-card permission. Game statistics are not included.",
  sources,
  players,
};
await fs.mkdir("public/data/rosters", { recursive: true });
await fs.writeFile(
  `public/data/rosters/${catalogue}.json`,
  JSON.stringify(document, null, 2),
);
await fs.mkdir("docs/qa/real-rosters", { recursive: true });
const report = {
  catalogue,
  hash: hash(document),
  counts: Object.fromEntries(
    Object.keys(fixtureSports).map((s) => [
      s,
      {
        players: players.filter((p) => p.sport === s).length,
        teams: new Set(
          players.filter((p) => p.sport === s).map((p) => p.currentTeam),
        ).size,
        positions: Object.fromEntries(
          fixtureSports[s as FixtureSport].positions.map((pos) => [
            pos,
            players.filter(
              (p) => p.sport === s && p.eligiblePositions?.includes(pos),
            ).length,
          ]),
        ),
      },
    ]),
  ),
  excluded: review.rejected.map(
    (p: { sport: string; name: string; team: string; reasons: string[] }) => ({
      sport: p.sport,
      name: p.name,
      team: p.team,
      reasons: p.reasons,
    }),
  ),
  duplicateIdentities: review.duplicates,
  permanentIssuance: false,
  realStatistics: false,
};
await fs.writeFile(
  "docs/qa/real-rosters/roster-review.json",
  JSON.stringify(report, null, 2),
);
console.log(report.counts);

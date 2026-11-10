/** Offline, deterministic proposal; never imports or changes an existing card. */
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { digest } from "../src/core/scoring-engine";
import { issuedInventoryManifest } from "../src/core/issued-inventory-manifest";
const dir = "private-data/v31-final-reconciliation-20261110",
  out = "docs/qa/v31-final-reconciliation-20261110";
mkdirSync(out, { recursive: true });
const read = (p: string) => JSON.parse(readFileSync(p, "utf8"));
const census = read(dir + "/census.private.json"),
  plan = read("docs/qa/v31-p1-p4-20261110/inventory-plan.json");
const candidate = read(
  "private-data/commercial-pool-20261106-v2/candidate.private.json",
);
const removals = read(
  "docs/qa/nfl-roster-audit/removal-manifest.json",
).approved;
const oldKeys = new Set(
  plan.unmatched.map((r: any) => [r.sport, r.player_id, r.rarity].join("|")),
);
const caps: Record<string, number> = {
  RARE: 5000,
  ELITE: 2500,
  ULTRA_RARE: 400,
  LEGENDARY: 50,
  ICON: 1,
};
const cards = census.records.filter((r: any) =>
  ["nfl", "afl", "nrl"].includes(r.player?.sport),
);
assert.equal(cards.length, 879, "Source changed: take a new reviewed census");
const serials = new Set(),
  ids = new Set();
const rows = cards
  .map((r: any) => {
    const p = r.player,
      c = r.doc,
      key = [p.sport, p.provider, p.providerId, c.rarity].join("|");
    assert(!ids.has(r.id));
    ids.add(r.id);
    assert(!serials.has(key + "|" + c.serial));
    serials.add(key + "|" + c.serial);
    assert(c.serial > 0 && c.serial <= caps[c.rarity]);
    assert(
      r.mirrors.every((m: any) => digest(m) === digest(c)),
      "Immutable mirrors conflict",
    );
    assert(
      r.receipt?.cards.includes(r.id),
      "Original pack does not contain this card",
    );
    assert.equal(r.receipt.id, c.source);
    assert.equal(r.receipt.product.sport, p.sport);
    assert.equal(r.receipt.product.status, "TEST_ONLY");
    const retired = r.locations.includes("retired");
    const removal = removals.find((m: any) => m.cards.includes(r.id));
    if (retired)
      assert(removal, "Retired card has no recorded prior cleanup authority");
    else
      assert(
        r.custody?.owner && r.ownership?.history?.length,
        "Active ownership missing",
      );
    const historical = r.ownership?.history ?? [];
    if (!retired)
      assert.equal(
        historical.at(-1).to,
        r.custody.owner,
        "Custody/history differ",
      );
    const evidence = census.evidence.filter(
      (e: any) => e.provider_id === p.providerId,
    );
    const exact =
      evidence.find((e: any) => e.player_id === p.id) ??
      (evidence.length === 1 ? evidence[0] : null);
    const excluded = oldKeys.has([p.sport, c.playerId, c.rarity].join("|"));
    const cause = !excluded
      ? "ACCOUNTED_IN_ORIGINAL_PROPOSAL"
      : retired
        ? "PRIOR_APPROVED_TEST_RETIREMENT"
        : p.sport === "afl"
          ? "FRESH_ROSTER_CANDIDATE_OMISSION"
          : !exact?.identity_verified
            ? "CURRENT_IDENTITY_UNVERIFIED"
            : exact.status !== "active"
              ? "CURRENT_ROSTER_NOT_ACTIVE"
              : !exact.catalogue_id
                ? "LEGACY_ID_WITHOUT_CATALOGUE_UUID"
                : "ACTIVE_IDENTITY_ABSENT_FROM_OLD_SNAPSHOT";
    return {
      immutableCardId: r.id,
      player: p.name,
      sport: p.sport,
      playerId: c.playerId,
      provider: p.provider,
      providerId: p.providerId,
      rarity: c.rarity,
      serial: c.serial,
      lifetimeCap: caps[c.rarity],
      mintedAt: new Date(c.mintedAt).toISOString(),
      sourcePack: c.source,
      sourceProduct: r.receipt.product.id,
      sourceStatus: r.receipt.product.status,
      sourceAt: new Date(r.receipt.createdAt).toISOString(),
      custody: retired
        ? "Previously retired TEST allocation; immutable serial remains consumed"
        : r.custody.reserved
          ? "Owned/reserved"
          : r.ownership.locked
            ? "Owned/locked"
            : r.listings.length
              ? "Owned/listed"
              : "Owned",
      owner: r.custody?.owner ?? null,
      originalRecipient: r.receipt.member,
      ownershipHistory: historical,
      transferred: historical.some(
        (h: any) => h.from && h.to && h.from !== h.to,
      ),
      immutableMirrorsAgree: true,
      receiptMatched: true,
      priorRetirement: removal ?? null,
      excluded,
      cause,
      currentSource: exact ?? null,
      identityDisposition: exact?.identity_verified
        ? "Current provider identity verified; eligibility still separate"
        : p.sport === "afl"
          ? "Historical Wikidata identity preserved; fresh source eligibility unresolved"
          : "Historical provider identity preserved; current official mapping unresolved",
      remediation: retired
        ? "Keep immutable ID and consumed serial. Preserve prior retirement; do not reinstate or remint without separate review."
        : excluded
          ? "Carry this issued serial in lifetime manifest regardless of active roster eligibility. Keep existing owner. Resolve source mapping before approving any new mint."
          : "Carry issued baseline and preserve owner; no replacement issuance.",
    };
  })
  .sort((a: any, b: any) => a.immutableCardId.localeCompare(b.immutableCardId));
const exceptions = rows.filter((r: any) => r.excluded);
assert.equal(exceptions.length, 86);
const groups = new Map<string, any>();
const verifiedManifest = issuedInventoryManifest(
  rows.map((r: any) => ({ ...r, id: r.immutableCardId })),
);
assert.equal(verifiedManifest.totalIssued, 879);
for (const r of rows) {
  const k = [r.sport, r.provider, r.providerId, r.rarity].join("|");
  const g = groups.get(k) ?? {
    sport: r.sport,
    player: r.player,
    playerId: r.playerId,
    provider: r.provider,
    providerId: r.providerId,
    rarity: r.rarity,
    cap: r.lifetimeCap,
    issued: 0,
    serials: [],
    ids: [],
    available: 0,
    reserved: 0,
  };
  g.issued++;
  g.serials.push(r.serial);
  g.ids.push(r.immutableCardId);
  groups.set(k, g);
}
for (const g of groups.values()) {
  g.serials.sort((a: number, b: number) => a - b);
  assert.equal(g.serials.at(-1), g.issued);
  assert(g.issued <= g.cap);
  g.remainingLifetimeCapacity = g.cap - g.issued;
}
const byCause = Object.fromEntries(
  [...new Set(exceptions.map((r: any) => r.cause))].map((c) => [
    c,
    exceptions.filter((r: any) => r.cause === c).length,
  ]),
);
const summary = {
  capturedAt: census.capturedAt,
  productionWrites: 0,
  totalIssued: 879,
  originalProposalAccounted: 793,
  exceptions: 86,
  accountedFor: rows.length,
  originalReceiptsMatched: rows.length,
  duplicateImmutableIds: 0,
  duplicateLimitedSerials: 0,
  overCapGroups: 0,
  activePreserved: rows.filter((r: any) => r.owner).length,
  retiredPreserved: rows.filter((r: any) => r.priorRetirement).length,
  byCause,
  exceptionTransfers: exceptions.filter((r: any) => r.transferred).length,
  hiddenNBAUnchanged: census.records.length - cards.length,
  importReady: false,
  sourceApproval: false,
  commercialDefinitions: 0,
  commercialCards: 0,
  distinction:
    "All 879 issued allocations accounted for. This is not current roster eligibility, source/import approval, restoration of retired ownership, or authority to mint. TEST and refunded allocations never replenish lifetime capacity.",
};
const proposal = {
  version: "preserve-all-issued-lifetime-proposal-v1",
  sourceCapturedAt: census.capturedAt,
  sourceSnapshotSha256: createHash("sha256")
    .update(readFileSync(dir + "/census.private.json"))
    .digest("hex"),
  originalCandidateSha256: createHash("sha256")
    .update(
      readFileSync(
        "private-data/commercial-pool-20261106-v2/candidate.private.json",
      ),
    )
    .digest("hex"),
  approved: false,
  importEnabled: false,
  rows: [...groups.values()],
  candidateDefinitions: candidate.rows.length,
  verifiedManifestDigest: verifiedManifest.digest,
  accountedFor: 879,
  unmatchedSourceGroups: plan.unmatched.length,
  rules: [
    "Match immutable IDs and exact provider identity; never names alone",
    "Reserve every legacy serial including retired/refunded/transferred cards",
    "Repeated manifest is a no-op; changed serial, source or owner rejects",
    "Do not create new UUIDs for unresolved legacy player identities",
    "Production loader remains blocked until complete mapping, fresh source and founder approval",
  ],
};
writeFileSync(
  dir + "/per-card-exceptions.private.json",
  JSON.stringify(exceptions, null, 2) + "\n",
  { mode: 0o600 },
);
writeFileSync(
  dir + "/all-issued.private.json",
  JSON.stringify(rows, null, 2) + "\n",
  { mode: 0o600 },
);
// Git evidence omits customer IDs, source transaction IDs and ownership history.
const safe = exceptions.map(
  ({ owner, originalRecipient, ownershipHistory, sourcePack, ...r }: any) => ({
    ...r,
    hasOwner: !!owner,
    originalRecipientPreserved: !!originalRecipient,
    ownershipHistoryEntries: ownershipHistory.length,
    sourcePackSha256: digest(sourcePack),
  }),
);
writeFileSync(
  out + "/per-card-exceptions.json",
  JSON.stringify(safe, null, 2) + "\n",
);
writeFileSync(
  out + "/inventory-source-proposal.json",
  JSON.stringify(proposal, null, 2) + "\n",
);
writeFileSync(
  out + "/reconciliation-summary.json",
  JSON.stringify({ ...summary, proposalDigest: digest(proposal) }, null, 2) +
    "\n",
);
console.log(JSON.stringify(summary));

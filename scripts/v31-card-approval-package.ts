/** Offline exact approval artifacts; never grants approval or connects to a DB. */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { inventoryOperatorPackage } from "./v31-reviewed-inventory-operator";
import { commercialPack, commercialSports } from "../src/core/commercial-billing";
import { hasRequiredPackSupply } from "../src/core/commercial-pack-supply";
import { digest } from "../src/core/scoring-engine";
const dir = "docs/qa/v31-prelaunch-20261111/cards";
const read = (file: string) => JSON.parse(readFileSync(file, "utf8"));
const sha = (file: string) => createHash("sha256").update(readFileSync(file)).digest("hex");
const write = (file: string, data: unknown) => writeFileSync(`${dir}/${file}`, JSON.stringify(data, null, 2) + "\n");
const planFile = "private-data/v31-card-research-20261111/complete-proposal.private.json";
const plan = read(planFile), source = read(`${dir}/current-source-comparison.json`), code = inventoryOperatorPackage();
write("inventory-approval.NOT-APPROVED.json", {
  approved: false, scope: "v31-preservation-only-inventory-import", projectRef: "pojoymtniryarxxunyvz",
  planSha256: sha(planFile), registrationDigest: plan.registrationDigest, operatorPackageDigest: code.operatorPackageDigest,
  preservationOnly: true, newIssuance: false, sales: false, publicRegistration: false, ownershipChanges: false, betaCatalogueChanges: false,
  approvalReference: "REPLACE_WITH_EXACT_FOUNDER_INSTRUCTION_REFERENCE", approvedAt: null, expiresAt: null, backupCapturedAt: null,
  preflightPath: "private-data/v31-card-research-20261111/import-preflight.private.json", preflightSha256: "REPLACE_WITH_FRESH_PREFLIGHT_SHA256",
  backupManifestPath: "private-data/REPLACE_WITH_FRESH_BACKUP/manifest.aes", backupManifestSha256: "REPLACE_WITH_SHA256",
  backupArchivePath: "private-data/REPLACE_WITH_FRESH_BACKUP/production.dump.aes", backupArchiveSha256: "REPLACE_WITH_SHA256",
});
const selected = new Set<string>(source.matchingDefinitionIds);
const held = plan.rows.filter((r: any) => !selected.has(r.id)).map((r: any) => r.id).sort();
assert.equal(selected.size, 6065);
assert.equal(held.length, 475);
const packChecks = commercialSports.flatMap(sport => (["STANDARD", "PREMIUM"] as const).flatMap(family => ([1, 3, 9] as const).map(size => {
  const product = commercialPack(sport, family, size);
  const supply = source.hypotheticalSupplyAfterSeparateEligibilityAndRightsApproval.filter((r: any) => r.sport === sport).map((r: any) => ({ rarity: r.rarity, players: r.playersWithCapacity }));
  const sufficient = hasRequiredPackSupply(product, supply);
  assert(sufficient);
  return { product: product.id, configurationHash: product.configurationHash, distinctPlayerCapacitySufficient: sufficient, currentlyAvailableForSale: false };
})));
const eligibility = {
  approved: false, productionWrites: 0, proposal: "Review exact fresh factual matches; retain all other definitions as historical-only",
  planSha256: sha(planFile), currentSourceComparisonSha256: sha(`${dir}/current-source-comparison.json`),
  sourceFreshnessHours: 72, refreshBeforeActivation: true, playerRightsApprovalRequired: true,
  proposedEligiblePlayers: 1213, proposedDefinitionIds: [...selected].sort(), proposedDefinitionsDigest: digest([...selected].sort()),
  heldDefinitionIds: held, heldDefinitionsDigest: digest(held), heldDefinitions: 475,
  heldGroups: { basePlayers: { nfl: 23, afl: 1, nrl: 56 }, baseDefinitions: 400, historicalAdditionalDefinitions: 75 },
  minimumDistinctPlayersWithRemainingCapacity: { nfl: 401, afl: 536, nrl: 274 },
  packChecks, saleableNow: 0, stockLoadRequired: false,
  model: "Existing pack purchase atomically mints at issued+1 against approved definitions under deterministic locks. Historical/retired/refunded allocations never replenish lifetime supply. No extra launch stock quantities are invented.",
};
write("current-eligibility.NOT-APPROVED.json", eligibility);
write("operator-package.json", code);
console.log(JSON.stringify({ planSha256: sha(planFile), operatorPackageDigest: code.operatorPackageDigest, proposedEligibilityDigest: eligibility.proposedDefinitionsDigest, currentSourceComparisonSha256: eligibility.currentSourceComparisonSha256, packChecksPassed: packChecks.length, productionWrites: 0 }));

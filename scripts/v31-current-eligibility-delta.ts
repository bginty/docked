/** Evidence-backed proposal only. Never opens a database or changes an import. */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { digest } from "../src/core/scoring-engine";
const out = "docs/qa/v31-revenue-launch-20261113/cards/";
const read = (file: string) => JSON.parse(readFileSync(file, "utf8"));
async function main() {
  const fresh = read(out + "current-source-comparison.json");
  const prior = read(
    "docs/qa/v31-prelaunch-20261111/cards/current-eligibility.NOT-APPROVED.json",
  );
  const planFile =
    "private-data/v31-card-research-20261111/complete-proposal.private.json";
  const planHash = createHash("sha256")
    .update(readFileSync(planFile))
    .digest("hex");
  assert.equal(
    planHash,
    "4b039916c4ef00698e10bfa9d14c41ce23b9febf06cf78e035ae595a08dd3ee4",
  );
  const plan = read(planFile),
    before = new Set<string>(prior.proposedDefinitionIds),
    after = new Set<string>(fresh.matchingDefinitionIds);
  const removed = [...before].filter((id) => !after.has(id)).sort(),
    added = [...after].filter((id) => !before.has(id)).sort();
  assert.equal(before.size, 6065);
  assert.equal(after.size, 6055);
  assert.equal(removed.length, 10);
  assert.equal(added.length, 0);
  const primarySources = [
    {
      player: "Nikko Remigio",
      url: "https://www.chiefs.com/team/transactions/2026",
      finding:
        "The Chiefs' 11 November 2026 transaction entry records Remigio waived. No current Active KC membership is established. Preserve historical cards and withhold five definitions from new issuance.",
    },
    {
      player: "Jack Todd",
      url: "https://www.castlefordtigers.com/article/550/todd-the-tiger---nrl-forward-pens-cas-deal",
      finding:
        "Castleford announces a two-year contract for the 2027/2028 seasons. The pinned Bulldogs 2026 identity is historical, but current roster/profile sources now disagree. Withhold five definitions under the existing current-eligibility rule; do not silently change the club or season.",
    },
  ];
  const sources: Array<{
    player: string;
    url: string;
    finding: string;
    checkedAt: string;
    sha256: string;
  }> = [];
  for (const [i, source] of primarySources.entries()) {
    const r = await fetch(source.url, {
      redirect: "error",
      signal: AbortSignal.timeout(30000),
    });
    assert(r.ok);
    const bytes = Buffer.from(await r.arrayBuffer());
    writeFileSync(
      `private-data/v31-revenue-launch-20261113/current-primary-${i + 1}.html`,
      bytes,
      { flag: "wx" },
    );
    sources.push({
      ...source,
      checkedAt: new Date().toISOString(),
      sha256: createHash("sha256").update(bytes).digest("hex"),
    });
  }
  const changes = fresh.records
    .filter((r: any) =>
      r.definitionIds.some((id: string) => removed.includes(id)),
    )
    .map((r: any) => ({
      playerId: r.playerId,
      name: r.name,
      sport: r.sport,
      pinnedTeam: r.pinnedTeam,
      pinnedSeason: r.pinnedSeason,
      definitionIds: r.definitionIds,
      reasons: r.reasons,
      primaryEvidence: sources.find((s) => s.player === r.name),
    }));
  assert.equal(changes.length, 2);
  const selected = [...after].sort();
  const proposal = {
    at: new Date().toISOString(),
    approved: false,
    productionWrites: 0,
    completeInventoryPlanSha256: planHash,
    completeInventoryUnchanged: true,
    dormantDefinitions: 6540,
    preservedLimitedCopies: 888,
    preservedCustodyRecords: 906,
    priorEligibleDefinitions: 6065,
    proposedEligibleDefinitions: 6055,
    proposedExcludedDefinitions: 485,
    proposedDefinitionIds: selected,
    proposedEligibilityDigest: digest(selected),
    removedDefinitionIds: removed,
    addedDefinitionIds: added,
    sourceComparisonSha256: createHash("sha256")
      .update(readFileSync(out + "current-source-comparison.json"))
      .digest("hex"),
    sourceFreshnessHours: 72,
    refreshBeforeActivation: true,
    changes,
    supply: fresh.hypotheticalSupplyAfterSeparateEligibilityAndRightsApproval,
    earlierIdentityApprovalsRetained: true,
    existingCardsDeletedOrReminted: 0,
    legalClearanceInferred: false,
  };
  assert.equal(plan.rows.length, 6540);
  writeFileSync(
    out + "current-eligibility-delta.NOT-APPROVED.json",
    JSON.stringify(proposal, null, 2) + "\n",
    { flag: "wx" },
  );
  console.log(
    JSON.stringify({
      proposedEligible: 6055,
      excluded: 485,
      eligibilityDigest: proposal.proposedEligibilityDigest,
      changes: changes.map((c: any) => ({
        name: c.name,
        sport: c.sport,
        definitions: c.definitionIds.length,
      })),
      inventoryPlanUnchanged: true,
      productionWrites: 0,
    }),
  );
}
main().catch(() => {
  console.error(
    "Current eligibility proposal incomplete; no catalogue or hosted records changed.",
  );
  process.exitCode = 1;
});

/** Read-only reconciliation of earlier approval with the deployed stable catalogue. */
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { ownerDatabase } from "./owner-gameplay-db.mjs";
import { digest } from "../src/core/scoring-engine";
const before = JSON.parse(
  readFileSync(
    "docs/qa/v31-prelaunch-20261111/cards/current-eligibility.NOT-APPROVED.json",
    "utf8",
  ),
);
const old = JSON.parse(
  readFileSync(
    "docs/qa/v31-revenue-launch-20261113/cards/current-eligibility-delta.NOT-APPROVED.json",
    "utf8",
  ),
);
const approved = new Set<string>(before.proposedDefinitionIds),
  oldIds = new Set<string>(old.proposedDefinitionIds);
assert.equal(approved.size, 6065);
const root = process.cwd();
process.chdir("C:/Users/61412/Documents/ChatGPT/Docked.com.au");
const sql = ownerDatabase();
process.chdir(root);
async function main() {
  try {
    const rows = await sql.begin(
      "isolation level repeatable read read only",
      async (tx) => {
        await tx`set local statement_timeout='30s'`;
        return tx`select d.id,d.sport,d.player_id,d.rarity,d.snapshot,
   m.provider,m.provider_id,m.evidence_sha256,m.rights_id,
   r.evidence as retained_use_basis, r.valid_until,
   case when m.player_id is not null then season_catalogue.can_issue(m.sport,m.season,m.player_id,'free_weekly') else false end retained_eligible
   from commercial_billing.definitions d left join season_catalogue.members m on m.player_id=d.player_id and m.sport=d.sport and m.season='2026' and m.scope='free_weekly'
   left join season_catalogue.rights r on r.id=m.rights_id order by d.id`;
      },
    );
    assert.equal(rows.length, 6540);
    const selected = rows.filter((r) => approved.has(r.id)),
      retained = selected.filter((r) => r.retained_eligible),
      held = selected.filter((r) => !r.retained_eligible);
    const result = {
      at: new Date().toISOString(),
      productionWrites: 0,
      earlierApproved: approved.size,
      retainedIdentities: retained.length,
      proposedDefinitionIds: selected.map((r) => r.id).sort(),
      definitionDigest: digest(selected.map((r) => r.id).sort()),
      proposalBasis:
        "Reuse founder-approved 6,065 paid definitions and their preserved historical evidence. Free Weekly membership is corroboration, not a new prerequisite for already-approved paid identities. No roster-refresh hold; no unapproved definition added.",
      oldRosterOnlyHolds: selected
        .filter((r) => !oldIds.has(r.id))
        .map((r) => ({
          id: r.id,
          sport: r.sport,
          snapshot: r.snapshot,
          retainedEligible: r.retained_eligible,
        })),
      separateWeeklyMembership: held.map((r) => ({
        id: r.id,
        sport: r.sport,
        playerId: r.player_id,
        snapshot: r.snapshot,
        rightsId: r.rights_id ?? null,
        note: "Jared Wayne remains in the previously approved paid subset; this proposal does not add him to free Weekly packs.",
      })),
      rightsBasis: [
        ...new Map(
          retained.map((r) => [
            r.rights_id,
            {
              id: r.rights_id,
              evidence: r.retained_use_basis,
              validUntil: r.valid_until,
            },
          ]),
        ).values(),
      ],
      scope:
        "Proposed paid identity subset only. Founder attests legal advice for names, colours and cities; no licensed logos/photos/statistics, no activation or source-collection authority.",
    };
    writeFileSync(
      "docs/qa/final-release-decision-20261117/season-eligibility.json",
      JSON.stringify(result, null, 2) + "\n",
    );
    console.log(
      JSON.stringify({
        earlierApproved: approved.size,
        retained: retained.length,
        held: held.length,
        rosterOnlyHolds: result.oldRosterOnlyHolds.length,
        digest: result.definitionDigest,
      }),
    );
  } finally {
    await sql.end();
  }
}
main().catch(() => {
  console.error("Read-only season review failed; no Production mutations.");
  process.exitCode = 1;
});
